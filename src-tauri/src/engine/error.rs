use serde::Serialize;
use std::io;

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Server returned {status_code}: {message}")]
    ServerError {
        status_code: u16,
        message: String,
    },

    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("HTTP Request error: {0}")]
    Request(#[from] reqwest::Error),

    #[error("URL Parse error: {0}")]
    InvalidUrl(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Download cancelled by user")]
    Cancelled,
}

impl From<url::ParseError> for EngineError {
    fn from(err: url::ParseError) -> Self {
        Self::InvalidUrl(err.to_string())
    }
}

impl Serialize for EngineError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
