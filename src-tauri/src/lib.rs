//! NextGenDM application entry point.
//!
//! Initialises logging, database, application state, Tauri plugins,
//! and registers all IPC command handlers.

mod commands;
mod config;
mod db;
mod engine;
mod state;
mod utils;

use commands::download_commands;
use commands::settings_commands;
use db::connection::initialize_database;
use state::app_state::AppState;
use tauri::Manager;

use tracing::{error, info, warn};
use tracing_subscriber::{fmt, EnvFilter};

/// Build and run the Tauri application.
pub fn run() {
    // ── Initialise tracing / logging ────────────────────────────────────
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("nextgendm_lib=debug,info"));

    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .init();

    info!("Starting NextGenDM v0.1.0");

    // ── Build Tauri application ─────────────────────────────────────────
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            download_commands::add_download,
            download_commands::start_download,
            download_commands::pause_download,
            download_commands::resume_download,
            download_commands::cancel_download,
            download_commands::remove_download,
            download_commands::get_download,
            download_commands::list_downloads,
            download_commands::get_active_progress,
            download_commands::open_file,
            download_commands::open_folder,
            settings_commands::get_settings,
            settings_commands::update_settings,
        ])
        .setup(|app| {
            info!("Running application setup");

            // ── Resolve app data directory ──────────────────────────────
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| {
                    error!(error = %e, "Cannot resolve app data directory");
                    e
                })?;

            info!(path = %app_data_dir.display(), "App data directory");

            // ── Initialise database ─────────────────────────────────────
            let db = initialize_database(&app_data_dir).map_err(|e| {
                error!(error = %e, "Database initialisation failed");
                Box::new(e) as Box<dyn std::error::Error>
            })?;

            // ── Default download directory ──────────────────────────────
            let download_dir = dirs::download_dir()
                .unwrap_or_else(|| {
                    warn!("Cannot determine system Downloads folder, using current dir");
                    std::path::PathBuf::from(".")
                })
                .to_string_lossy()
                .to_string();

            info!(download_dir = %download_dir, "Default download directory");

            // ── Crash recovery: mark any "downloading" records as paused
            {
                let stuck = db::repository::get_downloads_by_status(&db, "downloading")
                    .unwrap_or_default();

                if !stuck.is_empty() {
                    warn!(
                        count = stuck.len(),
                        "Found downloads stuck in 'downloading' state — marking as paused"
                    );
                    for d in &stuck {
                        if let Err(e) =
                            db::repository::update_download_status(&db, &d.id, "paused", None)
                        {
                            error!(id = %d.id, error = %e, "Failed to reset stuck download");
                        }
                    }
                }

                // Also reset any "connecting" downloads.
                let connecting = db::repository::get_downloads_by_status(&db, "connecting")
                    .unwrap_or_default();
                for d in &connecting {
                    let _ = db::repository::update_download_status(&db, &d.id, "paused", None);
                }
            }

            // ── Create and manage AppState ──────────────────────────────
            let app_state = AppState::new(db, download_dir);
            app.manage(app_state);

            // ── Kickstart Queue Manager ─────────────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                crate::engine::queue::try_start_next(app_handle);
            });

            info!("Application setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running NextGenDM");
}
