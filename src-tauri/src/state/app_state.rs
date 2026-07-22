//! Application state shared across all Tauri commands.

use dashmap::DashMap;
use rusqlite::Connection;
use std::sync::{Arc, Mutex, RwLock};
use tokio::task::JoinHandle;
use tokio::sync::watch;
use crate::engine::limiter::GlobalBandwidthLimiter;

/// A handle to a running download task, holding its cancellation channel
/// and the `JoinHandle` to the spawned tokio task.
pub struct DownloadHandle {
    /// Send `true` through this channel to cancel the download.
    pub cancel_tx: watch::Sender<bool>,
    /// Handle to the background download task.
    pub join_handle: JoinHandle<()>,
}

/// Central application state managed by Tauri.
///
/// - `db` is behind a `std::sync::Mutex` (single-connection, WAL mode).
/// - `active_downloads` uses `DashMap` for lock-free concurrent access.
/// - `http_client` is shared across all downloads (connection pooling).
pub struct AppState {
    /// Single database connection protected by a mutex.
    pub db: Mutex<Connection>,
    /// Currently active (in-progress) downloads.
    pub active_downloads: DashMap<String, DownloadHandle>,
    /// Shared HTTP client for all downloads.
    pub http_client: reqwest::Client,
    /// Global bandwidth limiter across all downloads.
    pub bandwidth_limiter: Arc<GlobalBandwidthLimiter>,
    /// Default download directory.
    pub download_dir: String,
    /// If set, the system will shut down after this specific download completes.
    pub shutdown_after_id: RwLock<Option<String>>,
}

impl AppState {
    /// Create a new `AppState` with a shared reqwest client configured for
    /// download-manager use.
    pub fn new(db: Connection, download_dir: String) -> Self {
        let http_client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(30))
            .timeout(std::time::Duration::from_secs(300))
            .redirect(reqwest::redirect::Policy::limited(10))
            .user_agent("NextGenDM/0.1.0")
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to build reqwest HTTP client");

        let limiter = Arc::new(GlobalBandwidthLimiter::new());
        limiter.clone().start_replenish_task();

        Self {
            db: Mutex::new(db),
            active_downloads: DashMap::new(),
            http_client,
            bandwidth_limiter: limiter,
            download_dir,
            shutdown_after_id: RwLock::new(None),
        }
    }
}
