//! Core domain types for the NextGenDM download engine.
//!
//! All types that cross the IPC boundary use `String` representations
//! for simplicity and robustness in serialization.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use uuid::Uuid;

// ─── DownloadId ─────────────────────────────────────────────────────────────

/// A strongly-typed wrapper around `uuid::Uuid` used to identify downloads.
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct DownloadId(pub Uuid);

impl DownloadId {
    /// Create a new random download ID.
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Create a `DownloadId` from an existing UUID string.
    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }

    /// Return the inner UUID as a `String`.
    pub fn to_string_inner(&self) -> String {
        self.0.to_string()
    }
}

impl Default for DownloadId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for DownloadId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ─── DownloadStatus ─────────────────────────────────────────────────────────

/// Lifecycle status of a download.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Connecting,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl DownloadStatus {
    /// Convert a database/IPC string back into a `DownloadStatus`.
    pub fn from_str_value(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "queued" => Self::Queued,
            "connecting" => Self::Connecting,
            "downloading" => Self::Downloading,
            "paused" => Self::Paused,
            "completed" => Self::Completed,
            "failed" => Self::Failed,
            "cancelled" => Self::Cancelled,
            _ => Self::Queued,
        }
    }

    /// Return the canonical string representation for DB/IPC storage.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Connecting => "connecting",
            Self::Downloading => "downloading",
            Self::Paused => "paused",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

impl fmt::Display for DownloadStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── DownloadCategory ───────────────────────────────────────────────────────

/// File category inferred from extension or MIME type.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadCategory {
    Video,
    Audio,
    Image,
    Document,
    Compressed,
    Program,
    Iso,
    Other,
}

impl DownloadCategory {
    /// Infer a category from a file extension (without leading dot).
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            // Video
            "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpg" | "mpeg"
            | "3gp" | "ts" => Self::Video,
            // Audio
            "mp3" | "flac" | "wav" | "aac" | "ogg" | "wma" | "m4a" | "opus" | "aiff" => {
                Self::Audio
            }
            // Image
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" | "tiff" | "tif"
            | "avif" | "heic" | "heif" => Self::Image,
            // Document
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "rtf" | "odt"
            | "ods" | "odp" | "csv" | "epub" | "mobi" => Self::Document,
            // Compressed
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "zst" | "lz4" | "tgz"
            | "tbz2" => Self::Compressed,
            // Program / Installer
            "exe" | "msi" | "dmg" | "deb" | "rpm" | "apk" | "appimage" | "snap" | "pkg"
            | "bat" | "sh" => Self::Program,
            // Disc images
            "iso" | "img" | "bin" | "cue" | "nrg" => Self::Iso,
            _ => Self::Other,
        }
    }

    /// Infer a category from a MIME type string.
    pub fn from_mime(mime: &str) -> Self {
        let lower = mime.to_lowercase();
        if lower.starts_with("video/") {
            Self::Video
        } else if lower.starts_with("audio/") {
            Self::Audio
        } else if lower.starts_with("image/") {
            Self::Image
        } else if lower.starts_with("text/")
            || lower.contains("pdf")
            || lower.contains("document")
            || lower.contains("spreadsheet")
            || lower.contains("presentation")
            || lower.contains("msword")
            || lower.contains("officedocument")
        {
            Self::Document
        } else if lower.contains("zip")
            || lower.contains("compressed")
            || lower.contains("archive")
            || lower.contains("tar")
            || lower.contains("gzip")
            || lower.contains("x-7z")
            || lower.contains("x-rar")
            || lower.contains("x-bzip")
            || lower.contains("x-xz")
        {
            Self::Compressed
        } else if lower.contains("executable")
            || lower.contains("x-msdownload")
            || lower.contains("x-msi")
            || lower.contains("x-deb")
            || lower.contains("x-rpm")
        {
            Self::Program
        } else if lower.contains("x-iso9660") || lower.contains("x-raw-disk-image") {
            Self::Iso
        } else {
            Self::Other
        }
    }

    /// Return the canonical string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Video => "video",
            Self::Audio => "audio",
            Self::Image => "image",
            Self::Document => "document",
            Self::Compressed => "compressed",
            Self::Program => "program",
            Self::Iso => "iso",
            Self::Other => "other",
        }
    }

    /// Parse from a string.
    pub fn from_str_value(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "video" => Self::Video,
            "audio" => Self::Audio,
            "image" => Self::Image,
            "document" => Self::Document,
            "compressed" => Self::Compressed,
            "program" => Self::Program,
            "iso" => Self::Iso,
            _ => Self::Other,
        }
    }
}

impl fmt::Display for DownloadCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── DownloadPriority ───────────────────────────────────────────────────────

/// Priority level for scheduling downloads.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadPriority {
    Low,
    Normal,
    High,
    Critical,
}

impl DownloadPriority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Normal => "normal",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }

    pub fn from_str_value(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "low" => Self::Low,
            "high" => Self::High,
            "critical" => Self::Critical,
            _ => Self::Normal,
        }
    }
}

impl fmt::Display for DownloadPriority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

// ─── DownloadInfo ───────────────────────────────────────────────────────────

/// Full information about a download, used for DB storage and IPC transport.
///
/// All temporal and enum fields use `String` so they serialize cleanly
/// across the Tauri IPC boundary without custom type converters on the
/// TypeScript side.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadInfo {
    pub id: String,
    pub url: String,
    pub final_url: Option<String>,
    pub filename: String,
    pub save_path: String,
    pub total_size: Option<u64>,
    pub downloaded_size: u64,
    pub status: String,
    pub category: String,
    pub priority: String,
    pub mime_type: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub checksum_expected: Option<String>,
    pub checksum_actual: Option<String>,
    pub error_message: Option<String>,
    /// JSON-encoded map of extra request headers.
    pub headers: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub is_resumable: bool,
    pub average_speed: f64,
}

// ─── DownloadProgress ───────────────────────────────────────────────────────

/// Real-time progress snapshot emitted as a Tauri event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: f64,
    pub eta_seconds: Option<f64>,
    pub percentage: f64,
    pub connections: u32,
    pub status: String,
}

// ─── NewDownloadRequest ─────────────────────────────────────────────────────

/// Payload sent from the frontend to add a new download.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDownloadRequest {
    pub url: String,
    pub save_path: Option<String>,
    pub filename: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub headers: Option<HashMap<String, String>>,
}

// ─── ServerCapabilities ─────────────────────────────────────────────────────

/// Information gathered from a HEAD/initial request to the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerCapabilities {
    pub supports_range: bool,
    pub content_length: Option<u64>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub content_type: Option<String>,
    pub filename_from_header: Option<String>,
}
