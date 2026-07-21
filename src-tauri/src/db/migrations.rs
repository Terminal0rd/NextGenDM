//! Database schema migrations.
//!
//! Uses `IF NOT EXISTS` throughout so migrations are idempotent and safe
//! to run on every application launch.

use rusqlite::Connection;
use tracing::info;

/// Run all database migrations on the given connection.
pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    info!("Running database migrations");

    // ── Downloads table ─────────────────────────────────────────────────
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS downloads (
            id               TEXT PRIMARY KEY NOT NULL,
            url              TEXT NOT NULL,
            audio_url        TEXT,
            final_url        TEXT,
            filename         TEXT NOT NULL,
            save_path        TEXT NOT NULL,
            total_size       INTEGER,
            downloaded_size  INTEGER NOT NULL DEFAULT 0,
            status           TEXT NOT NULL DEFAULT 'queued',
            category         TEXT NOT NULL DEFAULT 'other',
            priority         TEXT NOT NULL DEFAULT 'normal',
            mime_type        TEXT,
            etag             TEXT,
            last_modified    TEXT,
            checksum_expected TEXT,
            checksum_actual  TEXT,
            error_message    TEXT,
            headers          TEXT,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL,
            completed_at     TEXT,
            is_resumable     INTEGER NOT NULL DEFAULT 0,
            average_speed    REAL NOT NULL DEFAULT 0.0
        );
        ",
    )?;

    // Handle schema update for existing databases safely
    let _ = conn.execute("ALTER TABLE downloads ADD COLUMN audio_url TEXT", []);

    // ── Indices for common queries ──────────────────────────────────────
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_downloads_status   ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_downloads_category ON downloads(category);
        CREATE INDEX IF NOT EXISTS idx_downloads_created  ON downloads(created_at);
        ",
    )?;

    // ── Categories reference table ──────────────────────────────────────
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS categories (
            name        TEXT PRIMARY KEY NOT NULL,
            extensions  TEXT NOT NULL,
            save_path   TEXT
        );
        ",
    )?;

    // Insert default categories (ignore if already exist).
    let default_categories: &[(&str, &str)] = &[
        (
            "video",
            "mp4,mkv,avi,mov,wmv,flv,webm,m4v,mpg,mpeg,3gp,ts",
        ),
        ("audio", "mp3,flac,wav,aac,ogg,wma,m4a,opus,aiff"),
        (
            "image",
            "jpg,jpeg,png,gif,bmp,svg,webp,ico,tiff,tif,avif,heic",
        ),
        (
            "document",
            "pdf,doc,docx,xls,xlsx,ppt,pptx,txt,rtf,odt,ods,odp,csv,epub,mobi",
        ),
        (
            "compressed",
            "zip,rar,7z,tar,gz,bz2,xz,zst,lz4,tgz,tbz2",
        ),
        (
            "program",
            "exe,msi,dmg,deb,rpm,apk,appimage,snap,pkg,bat,sh",
        ),
        ("iso", "iso,img,bin,cue,nrg"),
        ("other", "*"),
    ];

    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO categories (name, extensions, save_path) VALUES (?1, ?2, NULL)",
    )?;

    for (name, exts) in default_categories {
        stmt.execute(rusqlite::params![name, exts])?;
    }

    // ── Settings table ──────────────────────────────────────────────────
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );
        ",
    )?;

    let default_settings: &[(&str, &str)] = &[
        ("max_concurrent_downloads", "3"),
        ("max_connections_per_download", "8"),
        ("speed_limit_bytes_per_sec", "0"),
        ("connect_timeout_secs", "30"),
        ("read_timeout_secs", "60"),
        ("user_agent", "NextGenDM/0.1.0"),
        ("theme", "dark"),
        ("language", "en"),
        ("auto_start_downloads", "true"),
        ("show_notifications", "true"),
    ];

    let mut stmt =
        conn.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)")?;

    for (key, value) in default_settings {
        stmt.execute(rusqlite::params![key, value])?;
    }

    info!("Database migrations completed");
    Ok(())
}
