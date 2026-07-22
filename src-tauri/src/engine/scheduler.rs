use std::time::Duration;
use chrono::{Local, NaiveTime};
use tauri::{AppHandle, Manager, Emitter};
use tracing::info;
use tauri_plugin_shell::ShellExt;

use crate::state::app_state::AppState;
use crate::config::settings::load_settings;
use crate::engine::queue::try_start_next;

pub fn start_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;

            let state = app.state::<AppState>();
            let db = match state.db.lock() {
                Ok(db) => db,
                Err(_) => continue,
            };

            let settings = load_settings(&db);
            
            if !settings.scheduler_enabled {
                continue;
            }

            let now = Local::now().time();
            let start_time = NaiveTime::parse_from_str(&settings.scheduler_start_time, "%H:%M").unwrap_or_else(|_| NaiveTime::from_hms_opt(2, 0, 0).unwrap());
            let stop_time = NaiveTime::parse_from_str(&settings.scheduler_stop_time, "%H:%M").unwrap_or_else(|_| NaiveTime::from_hms_opt(8, 0, 0).unwrap());

            // A simple logic: if start_time < stop_time, we are in the window if start <= now < stop.
            // If start_time > stop_time (e.g., 23:00 to 07:00), we are in the window if now >= start || now < stop.
            let in_window = if start_time < stop_time {
                now >= start_time && now < stop_time
            } else {
                now >= start_time || now < stop_time
            };

            if in_window {
                // If we are in the window, trigger queue start (which transitions Queued -> Downloading)
                drop(db); // release lock before starting
                try_start_next(app.clone());
            } else {
                // We are outside the window. Pause any active downloads.
                let active = crate::db::repository::get_downloads_by_status(&db, "downloading").unwrap_or_default();
                let active_count = active.len();
                
                for d in active {
                    let _ = crate::db::repository::update_download_status(&db, &d.id, "queued", None);
                    app.emit("download-updated", ()).unwrap_or_default();
                    // Since it was downloading, we need to abort the actual task.
                    // The AppState holds the active_downloads map.
                    if let Some(handle) = state.active_downloads.get(&d.id) {
                        let _ = handle.cancel_tx.send(true); // Signal cancellation
                    }
                    state.active_downloads.remove(&d.id);
                }

                // If shutdown is enabled and there are no active downloads left (and none queued if we wanted? 
                // Wait, if outside window, we just paused them all. So active_count > 0 means we just paused them.
                // If it was already 0, and there's nothing downloading, maybe we shouldn't spam shutdown.
                // Shutdown logic: usually shutdown when ALL queued downloads are finished.
                // Let's count queued. If queued == 0 and downloading == 0 and completed > 0 recently...
                // A simpler approach: if scheduler_shutdown is enabled, and there are NO downloading AND NO queued, shut down.
                if settings.scheduler_shutdown {
                    let queued = crate::db::repository::get_downloads_by_status(&db, "queued").unwrap_or_default();
                    if queued.is_empty() && active_count == 0 {
                        info!("Scheduler: Queue empty and shutdown enabled. Shutting down system.");
                        drop(db);
                        // Using tauri-plugin-shell to execute shutdown command
                        #[cfg(target_os = "windows")]
                        let _ = app.shell().command("shutdown").args(["/s", "/t", "60"]).spawn();
                        
                        #[cfg(not(target_os = "windows"))]
                        warn!("Shutdown is only implemented for Windows right now.");
                        
                        // Disable shutdown so we don't spam it every minute
                        if let Ok(db) = state.db.lock() {
                            let mut new_settings = settings.clone();
                            new_settings.scheduler_shutdown = false;
                            let _ = crate::config::settings::save_settings(&db, &new_settings);
                        }
                    }
                }
            }
        }
    });
}
