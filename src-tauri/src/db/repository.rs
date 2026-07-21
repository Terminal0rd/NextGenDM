//! Data-access functions for the `downloads` table.
//!
//! All functions accept a `&rusqlite::Connection` — the caller is
//! responsible for locking the `Mutex<Connection>` in `AppState`.

use crate::engine::error::EngineError;
use crate::engine::types::DownloadInfo;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use tracing::debug;

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Map a `rusqlite::Row` to a `DownloadInfo`.
fn row_to_download_info(row: &Row<'_>) -> Result<DownloadInfo, rusqlite::Error> {
    Ok(DownloadInfo {
        id: row.get("id")?,
        url: row.get("url")?,
        audio_url: row.get("audio_url")?,
        final_url: row.get("final_url")?,
        filename: row.get("filename")?,
        save_path: row.get("save_path")?,
        total_size: row.get("total_size")?,
        downloaded_size: row.get::<_, i64>("downloaded_size")? as u64,
        status: row.get("status")?,
        category: row.get("category")?,
        priority: row.get("priority")?,
        mime_type: row.get("mime_type")?,
        etag: row.get("etag")?,
        last_modified: row.get("last_modified")?,
        checksum_expected: row.get("checksum_expected")?,
        checksum_actual: row.get("checksum_actual")?,
        error_message: row.get("error_message")?,
        headers: row.get("headers")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        completed_at: row.get("completed_at")?,
        is_resumable: row.get::<_, i32>("is_resumable")? != 0,
        average_speed: row.get("average_speed")?,
    })
}

// ─── Repository functions ───────────────────────────────────────────────────

/// Insert a brand-new download record.
pub fn insert_download(conn: &Connection, info: &DownloadInfo) -> Result<(), EngineError> {
    debug!(id = %info.id, url = %info.url, "Inserting download record");

    conn.execute(
        "INSERT INTO downloads (
            id, url, audio_url, final_url, filename, save_path, total_size,
            downloaded_size, status, category, priority, mime_type,
            etag, last_modified, checksum_expected, checksum_actual,
            error_message, headers, created_at, updated_at,
            completed_at, is_resumable, average_speed
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6,
            ?7, ?8, ?9, ?10, ?11,
            ?12, ?13, ?14, ?15,
            ?16, ?17, ?18, ?19,
            ?20, ?21, ?22, ?23
        )",
        params![
            info.id,
            info.url,
            info.audio_url,
            info.final_url,
            info.filename,
            info.save_path,
            info.total_size.map(|v| v as i64),
            info.downloaded_size as i64,
            info.status,
            info.category,
            info.priority,
            info.mime_type,
            info.etag,
            info.last_modified,
            info.checksum_expected,
            info.checksum_actual,
            info.error_message,
            info.headers,
            info.created_at,
            info.updated_at,
            info.completed_at,
            info.is_resumable as i32,
            info.average_speed,
        ],
    )?;

    Ok(())
}

/// Fetch a single download by ID.
pub fn get_download(conn: &Connection, id: &str) -> Result<Option<DownloadInfo>, EngineError> {
    let mut stmt = conn.prepare("SELECT * FROM downloads WHERE id = ?1")?;
    let result = stmt
        .query_row(params![id], row_to_download_info)
        .optional()?;
    Ok(result)
}

/// List downloads with optional filtering, sorting, and pagination.
pub fn list_downloads(
    conn: &Connection,
    status_filter: Option<&str>,
    category_filter: Option<&str>,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<DownloadInfo>, EngineError> {
    let mut sql = String::from("SELECT * FROM downloads WHERE 1=1");
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(status) = status_filter {
        sql.push_str(&format!(
            " AND status = ?{}",
            param_values.len() + 1
        ));
        param_values.push(Box::new(status.to_string()));
    }

    if let Some(category) = category_filter {
        sql.push_str(&format!(
            " AND category = ?{}",
            param_values.len() + 1
        ));
        param_values.push(Box::new(category.to_string()));
    }

    // Whitelist allowed sort columns to prevent SQL injection.
    let sort_column = match sort_by.unwrap_or("created_at") {
        "filename" => "filename",
        "total_size" => "total_size",
        "status" => "status",
        "category" => "category",
        "priority" => "priority",
        "updated_at" => "updated_at",
        "completed_at" => "completed_at",
        "average_speed" => "average_speed",
        _ => "created_at",
    };

    let direction = match sort_dir.unwrap_or("desc") {
        "asc" | "ASC" => "ASC",
        _ => "DESC",
    };

    sql.push_str(&format!(" ORDER BY {sort_column} {direction}"));

    if let Some(lim) = limit {
        sql.push_str(&format!(
            " LIMIT ?{}",
            param_values.len() + 1
        ));
        param_values.push(Box::new(lim));
    }

    if let Some(off) = offset {
        sql.push_str(&format!(
            " OFFSET ?{}",
            param_values.len() + 1
        ));
        param_values.push(Box::new(off));
    }

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|b| b.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), row_to_download_info)?;
    let mut downloads = Vec::new();
    for row in rows {
        downloads.push(row?);
    }

    Ok(downloads)
}

/// Update only the status (and optionally the error message) of a download.
pub fn update_download_status(
    conn: &Connection,
    id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), EngineError> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET status = ?1, error_message = ?2, updated_at = ?3 WHERE id = ?4",
        params![status, error_message, now, id],
    )?;
    Ok(())
}

/// Update download progress (bytes downloaded and resumability flag).
pub fn update_download_progress(
    conn: &Connection,
    id: &str,
    downloaded_size: u64,
    is_resumable: bool,
) -> Result<(), EngineError> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET downloaded_size = ?1, is_resumable = ?2, updated_at = ?3 WHERE id = ?4",
        params![downloaded_size as i64, is_resumable as i32, now, id],
    )?;
    Ok(())
}

/// Mark a download as completed.
pub fn update_download_completion(
    conn: &Connection,
    id: &str,
    checksum: Option<&str>,
    average_speed: f64,
) -> Result<(), EngineError> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET status = 'completed', checksum_actual = ?1, average_speed = ?2,
         completed_at = ?3, updated_at = ?3 WHERE id = ?4",
        params![checksum, average_speed, now, id],
    )?;
    Ok(())
}

/// Delete a download record from the database.
pub fn delete_download(conn: &Connection, id: &str) -> Result<(), EngineError> {
    conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
    Ok(())
}

/// Fetch all downloads with a given status.
pub fn get_downloads_by_status(
    conn: &Connection,
    status: &str,
) -> Result<Vec<DownloadInfo>, EngineError> {
    let mut stmt =
        conn.prepare("SELECT * FROM downloads WHERE status = ?1 ORDER BY created_at ASC")?;
    let rows = stmt.query_map(params![status], row_to_download_info)?;
    let mut downloads = Vec::new();
    for row in rows {
        downloads.push(row?);
    }
    Ok(downloads)
}
