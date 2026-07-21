use crate::commands::download_commands::start_download;
use crate::db::repository;
use crate::state::app_state::AppState;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

/// Checks if there is available capacity and starts queued downloads if possible.
pub fn try_start_next(app: AppHandle) {
    let state = app.state::<AppState>();
    
    let mut to_start_ids = Vec::new();

    {
        // 1. Acquire DB lock
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return,
        };

        let settings = crate::config::settings::load_settings(&db);
        let max_concurrent = settings.max_concurrent_downloads;

        // 2. Count active from DB (connecting + downloading)
        let connecting_count = repository::get_downloads_by_status(&db, "connecting")
            .unwrap_or_default()
            .len() as u32;
        let downloading_count = repository::get_downloads_by_status(&db, "downloading")
            .unwrap_or_default()
            .len() as u32;
        let active_count = connecting_count + downloading_count;

        if active_count >= max_concurrent {
            return;
        }

        let available_slots = max_concurrent - active_count;

        // 3. Fetch queued
        let queued_downloads = match repository::get_downloads_by_status(&db, "queued") {
            Ok(downloads) => downloads,
            Err(e) => {
                warn!("Queue manager failed to fetch queued downloads: {}", e);
                return;
            }
        };

        if queued_downloads.is_empty() {
            return;
        }

        info!(
            available_slots = available_slots,
            queued = queued_downloads.len(),
            "Queue manager starting next downloads"
        );

        let to_start = queued_downloads.into_iter().take(available_slots as usize);

        for download in to_start {
            // Mark as connecting immediately to prevent race conditions
            let _ = repository::update_download_status(&db, &download.id, "connecting", None);
            to_start_ids.push(download.id);
        }
    } // DB lock dropped here

    // 4. Spawn the actual download tasks
    for id in to_start_ids {
        let app_clone = app.clone();
        
        tokio::spawn(async move {
            let app_for_start = app_clone.clone();
            let state_guard = app_clone.state::<AppState>();
            if let Err(e) = start_download(app_for_start, state_guard, id.clone()).await {
                warn!("Queue manager failed to start download {}: {}", id, e);
            }
        });
    }
}
