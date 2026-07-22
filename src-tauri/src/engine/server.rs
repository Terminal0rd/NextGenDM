use axum::{
    routing::{post, get},
    Router, Json, extract::{State, Query},
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct InterceptPayload {
    pub url: String,
    pub audio_url: Option<String>,
    pub filename: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct InterceptBatchPayload {
    pub url: String,
}

#[derive(Clone)]
struct ServerState {
    app: AppHandle,
}

/// Start the local HTTP server to listen for browser extension intercepts.
pub fn start_local_server(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = ServerState { app };
        
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app_router = Router::new()
            .route("/intercept", post(handle_intercept))
            .route("/intercept-batch", post(handle_intercept_batch))
            .route("/extract-media", get(handle_extract_media))
            .layer(cors)
            .with_state(Arc::new(state));

        let addr = SocketAddr::from(([127, 0, 0, 1], 14200));
        info!(port = 14200, "Starting local HTTP server for browser extension");

        let listener = tokio::net::TcpListener::bind(addr).await.unwrap_or_else(|e| {
            error!("Failed to bind local server to port 14200: {}", e);
            panic!("Cannot start extension server");
        });

        if let Err(e) = axum::serve(listener, app_router).await {
            error!("Local HTTP server error: {}", e);
        }
    });
}

async fn handle_intercept(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<InterceptPayload>,
) -> &'static str {
    info!("Received download intercept from browser extension: {}", payload.url);
    
    // Emit event to Tauri frontend to pop open the "Add Download" modal
    if let Err(e) = state.app.emit("intercept-download", payload) {
        error!("Failed to emit intercept-download event: {}", e);
        return "Internal Server Error";
    }

    if let Some(window) = state.app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    "OK"
}

async fn handle_intercept_batch(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<InterceptBatchPayload>,
) -> &'static str {
    info!("Received batch intercept from browser extension: {}", payload.url);
    
    let _ = state.app.emit("intercept-batch", payload);
    
    if let Some(window) = state.app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    
    "ok"
}

#[derive(Deserialize)]
pub struct ExtractQuery {
    pub url: String,
}

#[derive(Serialize)]
pub struct ExtractedFormat {
    pub format_type: String,
    pub resolution: String,
    pub ext: String,
    pub url: String,
    pub audio_url: Option<String>,
    pub filesize: Option<u64>,
    pub title: Option<String>,
}

async fn handle_extract_media(
    State(state): State<Arc<ServerState>>,
    Query(query): Query<ExtractQuery>,
) -> axum::response::Result<Json<Vec<ExtractedFormat>>, axum::http::StatusCode> {
    info!("Extracting media formats for {}", query.url);

    let output = state.app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?
        .args(["-j", "--no-warnings", &query.url])
        .output()
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    if !output.status.success() {
        return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let title = parsed["title"].as_str().map(|s| s.to_string());
    let formats = parsed["formats"].as_array().ok_or(axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    // Find the best audio-only stream to pair with video-only formats
    let best_audio = formats.iter().rev().find(|f| {
        f["vcodec"].as_str().unwrap_or("") == "none" && f["acodec"].as_str().unwrap_or("none") != "none"
    });

    let best_audio_url = best_audio.and_then(|a| a["url"].as_str().map(String::from));

    let mut results = Vec::new();

    // Iterate formats from best to worst (yt-dlp formats are usually ordered worst to best, but let's reverse to get best first)
    for f in formats.iter().rev() {
        let vcodec = f["vcodec"].as_str().unwrap_or("none");
        let acodec = f["acodec"].as_str().unwrap_or("none");
        let url = f["url"].as_str().unwrap_or("");
        
        if url.is_empty() {
            continue;
        }

        let format_type = if vcodec != "none" {
            "video"
        } else if acodec != "none" {
            "audio"
        } else {
            continue;
        };

        let resolution = if format_type == "audio" {
            if let Some(abr) = f["abr"].as_f64() {
                format!("{}kbps", abr.round() as u64)
            } else if let Some(abr) = f["abr"].as_u64() {
                format!("{}kbps", abr)
            } else {
                "Audio".to_string()
            }
        } else {
            f["format_note"].as_str()
                .or_else(|| f["resolution"].as_str())
                .unwrap_or("Unknown")
                .to_string()
        };
            
        let ext = f["ext"].as_str().unwrap_or("mp4").to_string();
        let filesize = f["filesize"].as_u64().or_else(|| f["filesize_approx"].as_u64());

        let mut audio_url = None;
        if format_type == "video" && acodec == "none" {
            audio_url = best_audio_url.clone();
        }

        // Deduplicate similar resolutions to keep list clean
        if !results.iter().any(|r: &ExtractedFormat| r.format_type == format_type && r.resolution == resolution && r.ext == ext) {
            results.push(ExtractedFormat {
                format_type: format_type.to_string(),
                resolution,
                ext,
                url: url.to_string(),
                audio_url,
                filesize,
                title: title.clone(),
            });
        }
    }

    // Add subtitles if any
    if let Some(subtitles) = parsed.get("subtitles").and_then(|s| s.as_object()) {
        for (lang, subs) in subtitles {
            if let Some(subs_array) = subs.as_array() {
                // Just take the best/first subtitle for the language
                if let Some(sub) = subs_array.last() {
                    let url = sub["url"].as_str().unwrap_or("");
                    let ext = sub["ext"].as_str().unwrap_or("vtt");
                    if !url.is_empty() {
                        results.push(ExtractedFormat {
                            format_type: "subtitle".to_string(),
                            resolution: lang.to_string(),
                            ext: ext.to_string(),
                            url: url.to_string(),
                            audio_url: None,
                            filesize: None,
                            title: title.clone(),
                        });
                    }
                }
            }
        }
    }

    Ok(Json(results))
}
