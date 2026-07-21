use axum::{
    routing::post,
    Router, Json, extract::State,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct InterceptPayload {
    pub url: String,
    pub filename: Option<String>,
}

#[derive(Clone)]
struct ServerState {
    app: AppHandle,
}

/// Start the local HTTP server to listen for browser extension intercepts.
pub fn start_local_server(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let state = ServerState { app };
        
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app_router = Router::new()
            .route("/intercept", post(handle_intercept))
            .layer(cors)
            .with_state(Arc::new(state));

        let addr = SocketAddr::from(([127, 0, 0, 1], 14200));
        info!(port = 14200, "Starting local HTTP server for browser extension");

        let listener = tokio::net::TcpListener::bind(addr).await.unwrap_or_else(|e| {
            error!("Failed to bind local server to port 14200: {}", e);
            panic!("Cannot start extension server");
        });

        if let Err(e) = axum::serve(listener, app_router).await {
            error!("Local HTTP server error: {}", e);
        }
    });
}

async fn handle_intercept(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<InterceptPayload>,
) -> &'static str {
    info!("Received download intercept from browser extension: {}", payload.url);
    
    // Emit event to Tauri frontend to pop open the "Add Download" modal
    if let Err(e) = state.app.emit("intercept-download", payload) {
        error!("Failed to emit intercept-download event: {}", e);
        return "Internal Server Error";
    }

    "OK"
}
