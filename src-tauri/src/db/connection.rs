//! Database connection initialisation.

use crate::engine::error::EngineError;
use rusqlite::Connection;
use std::path::Path;
use tracing::info;

/// Open (or create) the SQLite database, enable WAL mode and foreign keys,
/// and run all pending migrations.
pub fn initialize_database(app_data_dir: &Path) -> Result<Connection, EngineError> {
    // Ensure the data directory exists.
    if !app_data_dir.exists() {
        std::fs::create_dir_all(app_data_dir).map_err(|e| {
            EngineError::FileSystem(format!(
                "Cannot create app data directory {}: {e}",
                app_data_dir.display()
            ))
        })?;
    }

    let db_path = app_data_dir.join("nextgendm.db");
    info!(path = %db_path.display(), "Opening database");

    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for concurrent readers.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // Enable foreign key enforcement.
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // Reasonable busy timeout so writers wait instead of failing immediately.
    conn.pragma_update(None, "busy_timeout", 5000)?;

    super::migrations::run_migrations(&conn)?;

    info!("Database initialised successfully");
    Ok(conn)
}
