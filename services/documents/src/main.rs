#![forbid(unsafe_code)]

use documents::admission::Admission;
use documents::config::Config;
use documents::{AppState, health_probe, metrics, serve, telemetry};
use std::process::ExitCode;
use tokio::net::TcpListener;
use tokio::sync::watch;

#[tokio::main]
async fn main() -> ExitCode {
    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        return healthcheck().await;
    }
    telemetry::init();
    let config = match Config::from_env(|key| std::env::var(key).ok()) {
        Ok(config) => config,
        Err(error) => {
            tracing::error!(%error, "invalid configuration");
            return ExitCode::FAILURE;
        }
    };
    match run(config).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            tracing::error!(%error, "server failed");
            ExitCode::FAILURE
        }
    }
}

async fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::new(&config, Admission::for_this_machine());
    let grpc = TcpListener::bind(config.grpc_addr).await?;
    let metrics_listener = TcpListener::bind(config.metrics_addr).await?;
    let router = metrics::router(state.metrics(), config.metrics_token.clone());
    let (stop, mut stopped) = watch::channel(false);
    let metrics_server = tokio::spawn(async move {
        axum::serve(metrics_listener, router)
            .with_graceful_shutdown(async move {
                let _ = stopped.changed().await;
            })
            .await
    });
    tracing::info!(grpc = %config.grpc_addr, metrics = %config.metrics_addr, "listening");
    serve(grpc, state, telemetry::shutdown_signal()).await?;
    let _ = stop.send(true);
    metrics_server.await??;
    Ok(())
}

/// `documents healthcheck`: exit 0 when the local server reports SERVING (for Docker).
async fn healthcheck() -> ExitCode {
    let port = std::env::var("DOCUMENTS_GRPC_ADDR")
        .ok()
        .and_then(|addr| addr.parse::<std::net::SocketAddr>().ok())
        .map_or(50051, |addr| addr.port());
    if health_probe(&format!("http://127.0.0.1:{port}")).await {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
