use crate::engine::error::EngineError;
use crate::engine::progress::ProgressTracker;
use crate::engine::types::{DownloadId, ServerCapabilities};
use crate::db::repository;
use crate::AppState;
use futures::StreamExt;
use reqwest::header::{self, HeaderMap};
use std::path::Path;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tokio::sync::watch;
use tracing::{debug, error, warn, info};

const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);
const MAX_RETRIES: u32 = 5;
const BASE_RETRY_DELAY: Duration = Duration::from_secs(1);
const BUF_CAPACITY: usize = 64 * 1024;

pub async fn probe_capabilities(url: &str) -> Result<ServerCapabilities, EngineError> {
    let client = reqwest::Client::new();
    debug!(url = %url, "Probing server capabilities");

    let mut resp = client.head(url).send().await?;

    // If HEAD fails with 404, 405, etc., fallback to GET with Range: bytes=0-0
    if !resp.status().is_success() {
        warn!(status = %resp.status(), "HEAD request failed, falling back to GET probe");
        resp = client.get(url).header(header::RANGE, "bytes=0-0").send().await?;
        
        if !resp.status().is_success() {
            return Err(EngineError::ServerError {
                status_code: resp.status().as_u16(),
                message: format!("Probe request failed with status: {}", resp.status()),
            });
        }
    }

    let headers = resp.headers();
    let mut supports_range = headers
        .get(header::ACCEPT_RANGES)
        .map(|v| v.to_str().unwrap_or("") == "bytes")
        .unwrap_or(false);
    let mut content_length = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());

    // If we get a 206 Partial Content, Content-Length will be 1 (for bytes=0-0).
    // The actual total size is in Content-Range: bytes 0-0/TOTAL_SIZE
    if let Some(range_val) = headers.get(header::CONTENT_RANGE).and_then(|v| v.to_str().ok()) {
        if let Some(idx) = range_val.find('/') {
            if let Ok(total) = range_val[idx + 1..].parse::<u64>() {
                content_length = Some(total);
                supports_range = true;
            }
        }
    }

    let etag = headers
        .get(header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let last_modified = headers
        .get(header::LAST_MODIFIED)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    
    let filename_from_header = extract_filename_from_headers(headers);

    let caps = ServerCapabilities {
        supports_range,
        content_length,
        etag,
        last_modified,
        content_type,
        filename_from_header,
    };

    debug!(?caps, "Server capabilities determined");
    Ok(caps)
}

fn extract_filename_from_headers(headers: &HeaderMap) -> Option<String> {
    headers.get(header::CONTENT_DISPOSITION)
        .and_then(|v| v.to_str().ok())
        .and_then(|cd| {
            cd.split(';').find(|part| part.trim().starts_with("filename="))
                .map(|filename_part| {
                    let name = filename_part.split('=').nth(1).unwrap().trim();
                    name.trim_matches('"').to_string()
                })
        })
}

pub async fn start_download(
    app_handle: tauri::AppHandle,
    client: reqwest::Client,
    url: String,
    audio_url: Option<String>,
    save_path: &Path,
    download_id: DownloadId,
    total_size: Option<u64>,
    mut cancel_rx: watch::Receiver<bool>,
) -> Result<u64, EngineError> {
    crate::utils::fs::ensure_directory(save_path)?;

    let mut attempt = 0;
    
    loop {
        attempt += 1;
        let downloaded_so_far = crate::utils::fs::file_size(save_path);
        
        match attempt_download_orchestrator(&client, &url, &audio_url, save_path, &download_id, total_size, downloaded_so_far, &mut cancel_rx, &app_handle).await {
            Ok(size) => return Ok(size),
            Err(EngineError::Cancelled) => return Err(EngineError::Cancelled),
            Err(e) if is_transient(&e) && attempt <= MAX_RETRIES => {
                let delay = BASE_RETRY_DELAY * 2u32.pow(attempt - 1);
                warn!(%download_id, attempt, max = MAX_RETRIES, ?delay, error = %e, "Transient error, retrying");
                tokio::select! {
                    _ = tokio::time::sleep(delay) => {}
                    _ = cancel_rx.changed() => {
                        if *cancel_rx.borrow() {
                            return Err(EngineError::Cancelled);
                        }
                    }
                }
            }
            Err(e) => {
                error!(%download_id, attempt, error = %e, "Non-transient error");
                return Err(e);
            }
        }
    }
}

async fn attempt_download_orchestrator(
    client: &reqwest::Client,
    url: &str,
    audio_url: &Option<String>,
    save_path: &Path,
    download_id: &DownloadId,
    total_size: Option<u64>,
    downloaded_so_far: u64,
    cancel_rx: &mut watch::Receiver<bool>,
    app_handle: &tauri::AppHandle,
) -> Result<u64, EngineError> {
    if let Some(audio) = audio_url {
        // Multi-stream download
        let vid_path = save_path.with_extension("vid");
        let aud_path = save_path.with_extension("aud");

        // We download both streams sequentially. Since they are multi-threaded internally, it's fine.
        info!(%download_id, "Downloading video stream");
        let vid_size = attempt_download(client, url, &vid_path, download_id, None, 0, cancel_rx, app_handle).await?;
        
        info!(%download_id, "Downloading audio stream");
        let aud_size = attempt_download(client, audio, &aud_path, download_id, None, 0, cancel_rx, app_handle).await?;

        // Merge using ffmpeg
        info!(%download_id, "Merging audio and video streams via FFmpeg");
        use tauri_plugin_shell::ShellExt;
        
        let output = app_handle.shell().sidecar("ffmpeg")
            .map_err(|e| EngineError::System(format!("Failed to spawn ffmpeg: {}", e)))?
            .args(["-y", "-i", &vid_path.to_string_lossy(), "-i", &aud_path.to_string_lossy(), "-c", "copy", &save_path.to_string_lossy()])
            .output()
            .await
            .map_err(|e| EngineError::System(format!("FFmpeg execution failed: {}", e)))?;

        if !output.status.success() {
            return Err(EngineError::System(format!("FFmpeg merge failed: {}", String::from_utf8_lossy(&output.stderr))));
        }

        // Clean up temps
        let _ = std::fs::remove_file(&vid_path);
        let _ = std::fs::remove_file(&aud_path);

        Ok(vid_size + aud_size)
    } else {
        // Single stream download
        attempt_download(client, url, save_path, download_id, total_size, downloaded_so_far, cancel_rx, app_handle).await
    }
}

async fn attempt_download(
    client: &reqwest::Client,
    url: &str,
    save_path: &Path,
    download_id: &DownloadId,
    total_size: Option<u64>,
    downloaded_so_far: u64,
    cancel_rx: &mut watch::Receiver<bool>,
    app_handle: &tauri::AppHandle,
) -> Result<u64, EngineError> {
    let mut req = client.get(url);
    if downloaded_so_far > 0 {
        req = req.header(header::RANGE, format!("bytes={}-", downloaded_so_far));
        debug!(%download_id, downloaded_so_far, "Requesting range resume");
    }

    let resp = req.send().await?;
    let status = resp.status();

    if status.is_client_error() || status.is_server_error() {
        return Err(EngineError::ServerError {
            status_code: status.as_u16(),
            message: format!("Server returned {status}"),
        });
    }

    let file = if downloaded_so_far > 0 && (status == 206 || status == 200) {
        if status == 206 {
            tokio::fs::OpenOptions::new().create(true).append(true).open(save_path).await?
        } else {
            tokio::fs::File::create(save_path).await?
        }
    } else {
        tokio::fs::File::create(save_path).await?
    };

    let mut writer = tokio::io::BufWriter::with_capacity(BUF_CAPACITY, file);
    let mut stream = resp.bytes_stream();
    let mut tracker = ProgressTracker::with_initial(total_size, downloaded_so_far);
    let mut last_emit = Instant::now();
    let download_id_str = download_id.to_string();

    let limiter = app_handle.state::<AppState>().bandwidth_limiter.clone();

    while let Some(chunk_result) = stream.next().await {
        if *cancel_rx.borrow() {
            writer.flush().await?;
            return Err(EngineError::Cancelled);
        }

        let chunk = chunk_result.map_err(|e| EngineError::Network(e.to_string()))?;
        
        // Enforce global bandwidth limit
        limiter.acquire(chunk.len()).await;
        
        writer.write_all(&chunk).await?;
        tracker.update(chunk.len() as u64);

        if last_emit.elapsed() >= PROGRESS_INTERVAL {
            emit_progress(app_handle, &download_id_str, &mut tracker);
            last_emit = Instant::now();
        }
    }

    writer.flush().await?;
    emit_progress(app_handle, &download_id_str, &mut tracker);
    Ok(tracker.downloaded())
}

fn emit_progress(app_handle: &tauri::AppHandle, download_id: &str, tracker: &mut ProgressTracker) {
    let (speed, percentage, eta) = tracker.get_progress();
    let downloaded_bytes = tracker.downloaded();

    let payload = serde_json::json!({
        "id": download_id,
        "status": "downloading",
        "downloaded_bytes": downloaded_bytes,
        "total_bytes": tracker.total(),
        "speed_bytes_per_sec": speed,
        "percentage": percentage,
        "eta_seconds": eta,
        "connections": 1
    });

    if let Err(e) = app_handle.emit("download-progress", &payload) {
        error!(error = %e, "Failed to emit progress event");
    }

    let app_state = app_handle.state::<AppState>();
    if let Ok(db) = app_state.db.lock() {
        let _ = repository::update_download_progress(&db, download_id, downloaded_bytes, true);
    };
}

fn is_transient(error: &EngineError) -> bool {
    match error {
        EngineError::Network(_) => true,
        EngineError::ServerError { status_code, .. } => *status_code == 429 || *status_code >= 500,
        _ => false,
    }
}
