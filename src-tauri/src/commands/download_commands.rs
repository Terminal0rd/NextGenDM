use crate::engine::{downloader, error::EngineError, types::DownloadId};
use crate::db::repository;
use crate::state::app_state::{AppState, DownloadHandle};
use std::path::Path;
use tauri::{AppHandle, State, Emitter, Manager};
use tokio::sync::watch;
use tracing::{error, info};

#[tauri::command]
pub async fn add_download(
    _app: AppHandle,
    state: State<'_, AppState>,
    request: crate::engine::types::NewDownloadRequest,
) -> Result<crate::engine::types::DownloadInfo, String> {
    let url = request.url;
    let filename = request.filename;
    let save_directory = request.save_path;
    let category = request.category;
    let priority = request.priority.unwrap_or_else(|| "normal".to_string());
    
    info!(url = %url, "Adding new download");

    let caps = downloader::probe_capabilities(&url)
        .await
        .map_err(|e| e.to_string())?;

    let final_filename = filename.or(caps.filename_from_header).unwrap_or_else(|| {
        let parsed = url::Url::parse(&url).unwrap();
        parsed
            .path_segments()
            .and_then(|s| s.last())
            .unwrap_or("download")
            .to_string()
    });

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let settings = crate::config::settings::load_settings(&db);
    let final_dir = save_directory.unwrap_or(settings.default_download_path);

    let mut final_path = Path::new(&final_dir).join(&final_filename);
    final_path = crate::utils::fs::get_unique_filename(&final_path);

    let info = crate::engine::types::DownloadInfo {
        id: DownloadId::new().to_string_inner(),
        url,
        final_url: None,
        filename: final_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        save_path: final_path.to_string_lossy().to_string(),
        status: "queued".to_string(),
        total_size: caps.content_length,
        downloaded_size: 0,
        category: category.unwrap_or_else(|| "other".to_string()),
        priority,
        mime_type: caps.content_type,
        etag: caps.etag,
        last_modified: caps.last_modified,
        checksum_expected: None,
        checksum_actual: None,
        error_message: None,
        headers: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
        is_resumable: caps.supports_range,
        average_speed: 0.0,
    };

    repository::insert_download(&db, &info).map_err(|e| e.to_string())?;
    let auto_start = settings.auto_start_downloads;
    drop(db);

    if auto_start {
        let app_clone = _app.clone();
        tokio::task::spawn_blocking(move || {
            crate::engine::queue::try_start_next(app_clone);
        });
    }

    Ok(info)
}

#[tauri::command]
pub async fn start_download(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let info = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        repository::get_download(&db, &id)
            .map_err(|e| e.to_string())?
            .ok_or("Download not found")?
    };

    info!(id = %id, "Starting download");

    if info.status == "completed" {
        return Ok(());
    }

    if state.active_downloads.contains_key(&id) {
        return Ok(());
    }

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        repository::update_download_status(&db, &id, "connecting", None)
            .map_err(|e| e.to_string())?;
    }
    
    app.emit("download-status-changed", serde_json::json!({"id": id, "status": "connecting"})).unwrap_or_default();

    let (cancel_tx, cancel_rx) = watch::channel(false);
    let app_clone = app.clone();
    let id_clone = id.clone();

    let join_handle = tokio::spawn(async move {
        let state_guard = app_clone.state::<AppState>();
        let client = state_guard.http_client.clone();
        let save_path = Path::new(&info.save_path);
        let download_id = DownloadId::from_string(&id_clone).unwrap();

        {
            let db = state_guard.db.lock().unwrap();
            let _ = repository::update_download_status(&db, &id_clone, "downloading", None);
        }
        app_clone.emit("download-status-changed", serde_json::json!({"id": id_clone, "status": "downloading"})).unwrap_or_default();

        match downloader::start_download(
            app_clone.clone(),
            client,
            info.url.clone(),
            save_path,
            download_id,
            info.total_size,
            cancel_rx,
        )
        .await
        {
            Ok(size) => {
                info!(id = %id_clone, size, "Download completed");
                if let Ok(db) = state_guard.db.lock() {
                    let _ = repository::update_download_progress(&db, &id_clone, size, false);
                    let _ = repository::update_download_completion(&db, &id_clone, None, 0.0);
                }
                app_clone.emit("download-status-changed", serde_json::json!({"id": id_clone, "status": "completed"})).unwrap_or_default();
            }
            Err(EngineError::Cancelled) => {
                info!(id = %id_clone, "Download cancelled/paused");
                let final_size = crate::utils::fs::file_size(save_path);
                if let Ok(db) = state_guard.db.lock() {
                    let _ = repository::update_download_progress(&db, &id_clone, final_size, true);
                }
            }
            Err(e) => {
                error!(id = %id_clone, error = %e, "Download failed");
                let err_msg = e.to_string();
                if let Ok(db) = state_guard.db.lock() {
                    let _ = repository::update_download_status(&db, &id_clone, "failed", Some(&err_msg));
                }
                app_clone.emit("download-status-changed", serde_json::json!({
                    "id": id_clone,
                    "status": "failed",
                    "error": err_msg
                })).unwrap_or_default();
            }
        }

        state_guard.active_downloads.remove(&id_clone);
        
        let app_clone_for_queue = app_clone.clone();
        tokio::task::spawn_blocking(move || {
            crate::engine::queue::try_start_next(app_clone_for_queue);
        });
    });

    state.active_downloads.insert(id, DownloadHandle { cancel_tx, join_handle });

    Ok(())
}

#[tauri::command]
pub async fn pause_download(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    info!(id = %id, "Pausing download");

    if let Some((_, handle)) = state.active_downloads.remove(&id) {
        let _ = handle.cancel_tx.send(true);
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    repository::update_download_status(&db, &id, "paused", None)
        .map_err(|e| e.to_string())?;
    
    app.emit("download-status-changed", serde_json::json!({"id": id, "status": "paused"})).unwrap_or_default();
    
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        crate::engine::queue::try_start_next(app_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn resume_download(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    info!(id = %id, "Resuming download (adding to queue)");
    
    if state.active_downloads.contains_key(&id) {
        return Ok(());
    }

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        repository::update_download_status(&db, &id, "queued", None)
            .map_err(|e| e.to_string())?;
    }
    app.emit("download-status-changed", serde_json::json!({"id": id, "status": "queued"})).unwrap_or_default();

    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        crate::engine::queue::try_start_next(app_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    info!(id = %id, "Cancelling download");
    
    if let Some((_, handle)) = state.active_downloads.remove(&id) {
        let _ = handle.cancel_tx.send(true);
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    repository::update_download_status(&db, &id, "cancelled", None)
        .map_err(|e| e.to_string())?;
    
    app.emit("download-status-changed", serde_json::json!({"id": id, "status": "cancelled"})).unwrap_or_default();
    
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        crate::engine::queue::try_start_next(app_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn remove_download(app: AppHandle, state: State<'_, AppState>, id: String, delete_file: bool) -> Result<(), String> {
    info!(id = %id, delete_file, "Removing download");

    if let Some((_, handle)) = state.active_downloads.remove(&id) {
        let _ = handle.cancel_tx.send(true);
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Ok(Some(info)) = repository::get_download(&db, &id) {
        if delete_file {
            let path = Path::new(&info.save_path);
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }
    }

    repository::delete_download(&db, &id).map_err(|e| e.to_string())?;
    app.emit("download-removed", serde_json::json!({"id": id})).unwrap_or_default();

    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        crate::engine::queue::try_start_next(app_clone);
    });

    Ok(())
}

#[tauri::command]
pub async fn list_downloads(
    state: State<'_, AppState>,
    status_filter: Option<String>,
    category_filter: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<crate::engine::types::DownloadInfo>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    repository::list_downloads(
        &db, 
        status_filter.as_deref(), 
        category_filter.as_deref(), 
        sort_by.as_deref(), 
        sort_dir.as_deref(), 
        limit, 
        offset
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_download(state: State<'_, AppState>, id: String) -> Result<Option<crate::engine::types::DownloadInfo>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    repository::get_download(&db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_progress(_state: State<'_, AppState>) -> Result<Vec<crate::engine::types::DownloadProgress>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn open_file(app: AppHandle, _state: State<'_, AppState>, id: String) -> Result<(), String> {
    let state_guard = app.state::<AppState>();
    let db = state_guard.db.lock().map_err(|e| e.to_string())?;
    let info = repository::get_download(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Not found")?;

    opener::open(info.save_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_folder(app: AppHandle, _state: State<'_, AppState>, id: String) -> Result<(), String> {
    let state_guard = app.state::<AppState>();
    let db = state_guard.db.lock().map_err(|e| e.to_string())?;
    let info = repository::get_download(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Not found")?;

    let path = Path::new(&info.save_path);
    if let Some(folder) = path.parent() {
        let _ = opener::open(folder).map_err(|e| e.to_string());
    }
    Ok(())
}
