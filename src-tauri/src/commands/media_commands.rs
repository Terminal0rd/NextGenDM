use crate::engine::error::EngineError;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tracing::{debug, error, info};

#[derive(Serialize, Deserialize)]
pub struct MediaExtractionResult {
    pub title: Option<String>,
    pub url: String,
    pub filename: Option<String>,
}

#[tauri::command]
pub async fn extract_media_info(
    app: AppHandle,
    url: String,
) -> Result<MediaExtractionResult, EngineError> {
    info!(url = %url, "Starting media extraction via yt-dlp");

    // We use `-f b` (best single file with both audio & video) because
    // NextGenDM does not yet support merging separate audio/video streams via FFmpeg.
    let output = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| EngineError::System(format!("Failed to setup yt-dlp sidecar: {}", e)))?
        .args(["-j", "-f", "b", "--no-warnings", &url])
        .output()
        .await
        .map_err(|e| EngineError::System(format!("yt-dlp execution failed: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!(stderr = %stderr, "yt-dlp failed");
        return Err(EngineError::System(format!("yt-dlp error: {}", stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    let parsed: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| EngineError::System(format!("Failed to parse yt-dlp output: {}", e)))?;

    let download_url = parsed["url"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| EngineError::System("Could not find direct URL in yt-dlp output".into()))?;

    let title = parsed["title"].as_str().map(|s| s.to_string());
    
    // Construct a safe filename
    let filename = if let (Some(t), Some(ext)) = (title.as_ref(), parsed["ext"].as_str()) {
        let safe_title = t.replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-', "_");
        Some(format!("{}.{}", safe_title, ext))
    } else {
        None
    };

    debug!(url = %download_url, title = ?title, "Extraction successful");

    Ok(MediaExtractionResult {
        title,
        url: download_url,
        filename,
    })
}
