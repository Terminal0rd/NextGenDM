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

use crate::commands::{download_commands, settings_commands, media_commands, grabber_commands};
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
            download_commands::set_shutdown_after,
            download_commands::get_shutdown_after,
            settings_commands::get_settings,
            settings_commands::update_settings,
            media_commands::extract_media_info,
            grabber_commands::grab_site,
        ])
        .setup(|app| {
            info!("Running application setup");

            // ── System Tray & Window Behavior ───────────────────────────
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit NextGenDM", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        win_clone.hide().unwrap();
                        api.prevent_close();
                    }
                });
            }

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
            
            // Set initial speed limit from DB
            if let Ok(db) = app_state.db.lock() {
                let settings = crate::config::settings::load_settings(&db);
                app_state.bandwidth_limiter.set_limit(settings.speed_limit_bytes_per_sec);
            }
            
            app.manage(app_state);

            // ── Kickstart Queue Manager ─────────────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                crate::engine::queue::try_start_next(app_handle);
            });

            // ── Start Browser Extension Interceptor Server ──────────────
            crate::engine::server::start_local_server(app.handle().clone());

            // ── Start Download Scheduler ────────────────────────────────
            crate::engine::scheduler::start_scheduler(app.handle().clone());

            info!("Application setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while running NextGenDM");
}
