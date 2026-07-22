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
    pub routing_rules: std::collections::HashMap<String, String>,
    pub scheduler_enabled: bool,
    pub scheduler_start_time: String,
    pub scheduler_stop_time: String,
    pub scheduler_shutdown: bool,
    pub run_on_startup: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let download_path = dirs::download_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .to_string_lossy()
            .to_string();

        let mut routing_rules = std::collections::HashMap::new();
        if let Some(video_dir) = dirs::video_dir() {
            routing_rules.insert("video".to_string(), video_dir.to_string_lossy().into_owned());
        }
        if let Some(audio_dir) = dirs::audio_dir() {
            routing_rules.insert("audio".to_string(), audio_dir.to_string_lossy().into_owned());
        }
        if let Some(pic_dir) = dirs::picture_dir() {
            routing_rules.insert("image".to_string(), pic_dir.to_string_lossy().into_owned());
        }
        if let Some(doc_dir) = dirs::document_dir() {
            routing_rules.insert("document".to_string(), doc_dir.to_string_lossy().into_owned());
        }

        Self {
            default_download_path: download_path,
            max_concurrent_downloads: 3,
            max_connections_per_download: 8,
            speed_limit_bytes_per_sec: 0,
            connect_timeout_secs: 30,
            read_timeout_secs: 60,
            user_agent: "NextGenDM/0.1.0".to_string(),
            theme: "dark".to_string(),
            language: "en-US".to_string(),
            auto_start_downloads: true,
            show_notifications: true,
            routing_rules,
            scheduler_enabled: false,
            scheduler_start_time: "02:00".to_string(),
            scheduler_stop_time: "08:00".to_string(),
            scheduler_shutdown: false,
            run_on_startup: true,
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

    let routing_rules = get_setting(conn, "routing_rules")
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or(defaults.routing_rules);

    let scheduler_enabled = get_setting(conn, "scheduler_enabled")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(defaults.scheduler_enabled);

    let scheduler_start_time = get_setting(conn, "scheduler_start_time")
        .unwrap_or(defaults.scheduler_start_time);

    let scheduler_stop_time = get_setting(conn, "scheduler_stop_time")
        .unwrap_or(defaults.scheduler_stop_time);

    let scheduler_shutdown = get_setting(conn, "scheduler_shutdown")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(defaults.scheduler_shutdown);

    let run_on_startup = get_setting(conn, "run_on_startup")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(defaults.run_on_startup);

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
        routing_rules,
        scheduler_enabled,
        scheduler_start_time,
        scheduler_stop_time,
        scheduler_shutdown,
        run_on_startup,
    }
}

/// Save (upsert) a single setting to the database.
pub fn save_setting(conn: &Connection, key: &str, value: &str) -> Result<(), EngineError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(EngineError::Database)?;
    Ok(())
}

/// Save all settings.
pub fn save_settings(conn: &Connection, settings: &AppSettings) -> Result<(), EngineError> {
    let pairs = [
        ("default_download_path", settings.default_download_path.clone()),
        ("max_concurrent_downloads", settings.max_concurrent_downloads.to_string()),
        ("max_connections_per_download", settings.max_connections_per_download.to_string()),
        ("speed_limit_bytes_per_sec", settings.speed_limit_bytes_per_sec.to_string()),
        ("connect_timeout_secs", settings.connect_timeout_secs.to_string()),
        ("read_timeout_secs", settings.read_timeout_secs.to_string()),
        ("user_agent", settings.user_agent.clone()),
        ("theme", settings.theme.clone()),
        ("language", settings.language.clone()),
        ("auto_start_downloads", settings.auto_start_downloads.to_string()),
        ("show_notifications", settings.show_notifications.to_string()),
        (
            "routing_rules",
            serde_json::to_string(&settings.routing_rules).unwrap_or_default(),
        ),
        ("scheduler_enabled", settings.scheduler_enabled.to_string()),
        ("scheduler_start_time", settings.scheduler_start_time.clone()),
        ("scheduler_stop_time", settings.scheduler_stop_time.clone()),
        ("scheduler_shutdown", settings.scheduler_shutdown.to_string()),
        ("run_on_startup", settings.run_on_startup.to_string()),
    ];

    for (k, v) in pairs {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![k, v],
        )
        .map_err(EngineError::Database)?;
    }

    Ok(())
}
