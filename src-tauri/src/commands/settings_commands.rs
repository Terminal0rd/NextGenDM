//! IPC commands for reading and updating application settings.

use crate::config::settings::{self, AppSettings};
use crate::state::app_state::AppState;
use tauri::State;
use tracing::info;

/// Return all current settings to the frontend.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(settings::load_settings(&db))
}

/// Update one or more settings. Accepts a partial JSON object —
/// only keys present in the payload will be written.
#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings_update: serde_json::Value,
) -> Result<AppSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(obj) = settings_update.as_object() {
        for (key, value) in obj {
            let str_value = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Number(n) => n.to_string(),
                _ => continue,
            };
            info!(key = %key, value = %str_value, "Updating setting");
            settings::save_setting(&db, key, &str_value)
                .map_err(|e| e.to_string())?;
        }
    }

    // Return the full updated settings so the frontend can sync
    let new_settings = settings::load_settings(&db);
    
    // Apply changes dynamically
    state.bandwidth_limiter.set_limit(new_settings.speed_limit_bytes_per_sec);
    
    Ok(new_settings)
}
