//! Application settings stored in the `settings` key-value table.

use crate::engine::error::EngineError;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

/// Application-level settings with sensible defaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_download_path: String,
    pub max_concurrent_downloads: u32,
    pub max_connections_per_download: u32,
    pub speed_limit_bytes_per_sec: u64,
    pub connect_timeout_secs: u64,
    pub read_timeout_secs: u64,
    pub user_agent: String,
    pub theme: String,
    pub language: String,
    pub auto_start_downloads: bool,
    pub show_notifications: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let download_path = dirs::download_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .to_string_lossy()
            .to_string();

        Self {
            default_download_path: download_path,
            max_concurrent_downloads: 3,
            max_connections_per_download: 8,
            speed_limit_bytes_per_sec: 0,
            connect_timeout_secs: 30,
            read_timeout_secs: 60,
            user_agent: "NextGenDM/0.1.0".to_string(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            auto_start_downloads: true,
            show_notifications: true,
        }
    }
}

/// Read a single setting value from the database.
fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .ok()
    .flatten()
}

/// Load all settings from the database, falling back to defaults for
/// any missing keys.
pub fn load_settings(conn: &Connection) -> AppSettings {
    let defaults = AppSettings::default();

    let default_download_path = get_setting(conn, "default_download_path")
        .unwrap_or(defaults.default_download_path);

    let max_concurrent_downloads = get_setting(conn, "max_concurrent_downloads")
        .and_then(|v| v.parse().ok())
        .unwrap_or(defaults.max_concurrent_downloads);

    let max_connections_per_download = get_setting(conn, "max_connections_per_download")
        .and_then(|v| v.parse().ok())
        .unwrap_or(defaults.max_connections_per_download);

    let speed_limit_bytes_per_sec = get_setting(conn, "speed_limit_bytes_per_sec")
        .and_then(|v| v.parse().ok())
        .unwrap_or(defaults.speed_limit_bytes_per_sec);

    let connect_timeout_secs = get_setting(conn, "connect_timeout_secs")
        .and_then(|v| v.parse().ok())
        .unwrap_or(defaults.connect_timeout_secs);

    let read_timeout_secs = get_setting(conn, "read_timeout_secs")
        .and_then(|v| v.parse().ok())
        .unwrap_or(defaults.read_timeout_secs);

    let user_agent = get_setting(conn, "user_agent")
        .unwrap_or(defaults.user_agent);

    let theme = get_setting(conn, "theme")
        .unwrap_or(defaults.theme);

    let language = get_setting(conn, "language")
        .unwrap_or(defaults.language);

    let auto_start_downloads = get_setting(conn, "auto_start_downloads")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(defaults.auto_start_downloads);

    let show_notifications = get_setting(conn, "show_notifications")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(defaults.show_notifications);

    AppSettings {
        default_download_path,
        max_concurrent_downloads,
        max_connections_per_download,
        speed_limit_bytes_per_sec,
        connect_timeout_secs,
        read_timeout_secs,
        user_agent,
        theme,
        language,
        auto_start_downloads,
        show_notifications,
    }
}

/// Save (upsert) a single setting to the database.
pub fn save_setting(conn: &Connection, key: &str, value: &str) -> Result<(), EngineError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
