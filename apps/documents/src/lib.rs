//! The documents service: renders the app's PDFs over gRPC.
#![forbid(unsafe_code)]

pub mod admission;
mod auth;
pub mod certificate;
pub mod config;
mod draw;
pub mod fonts;
pub mod layout;
mod limits;
pub mod metrics;
pub mod qr;
mod service;
pub mod sheet;
pub mod telemetry;
pub mod ticket;

/// Generated from `packages/proto/harmonogram/documents/v1/documents.proto`.
pub mod proto {
    tonic::include_proto!("harmonogram.documents.v1");
}

use admission::Admission;
use config::Config;
use fonts::Fonts;
use metrics::Metrics;
use proto::document_service_server::{DocumentServiceServer, SERVICE_NAME};
use service::Documents;
use std::future::Future;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_stream::wrappers::TcpListenerStream;
use tonic::service::interceptor::InterceptedService;
use tonic::transport::Server;

/// Everything a running server needs.
pub struct AppState {
    token: Arc<str>,
    documents: Documents,
    readiness: metrics::Readiness,
}

impl AppState {
    pub fn new(config: &Config, admission: Admission) -> Self {
        let metrics = Arc::new(Metrics::new(admission.in_use()));
        Self {
            token: config.token.as_str().into(),
            documents: Documents {
                fonts: Arc::new(Fonts::load()),
                admission,
                metrics,
            },
            readiness: Default::default(),
        }
    }

    /// Shared with `/healthz` on the metrics port.
    pub fn readiness(&self) -> metrics::Readiness {
        self.readiness.clone()
    }

    pub fn metrics(&self) -> Arc<Metrics> {
        self.documents.metrics.clone()
    }
}

/// Serves gRPC on `listener` until `shutdown` resolves, then lets in-flight calls finish.
/// The health service needs no token (container health checks call it).
pub async fn serve(
    listener: TcpListener,
    state: AppState,
    shutdown: impl Future<Output = ()>,
) -> Result<(), tonic::transport::Error> {
    let (health, health_service) = tonic_health::server::health_reporter();
    health
        .set_service_status(SERVICE_NAME, tonic_health::ServingStatus::Serving)
        .await;
    let token = state.token;
    let readiness = state.readiness;
    let documents = DocumentServiceServer::new(state.documents)
        .max_decoding_message_size(limits::MAX_MESSAGE_BYTES)
        .max_encoding_message_size(limits::MAX_MESSAGE_BYTES);
    let documents = InterceptedService::new(documents, move |request: tonic::Request<()>| {
        auth::check(request.metadata(), &token).map(|()| request)
    });
    readiness.store(true, std::sync::atomic::Ordering::Relaxed);
    Server::builder()
        .add_service(health_service)
        .add_service(documents)
        .serve_with_incoming_shutdown(TcpListenerStream::new(listener), {
            let readiness = readiness.clone();
            async move {
                shutdown.await;
                readiness.store(false, std::sync::atomic::Ordering::Relaxed);
            }
        })
        .await
}

/// Whether the gRPC server at `addr` (e.g. `http://127.0.0.1:50051`) reports `SERVING`.
pub async fn health_probe(addr: &str) -> bool {
    use std::time::Duration;
    use tonic_health::pb::health_check_response::ServingStatus;
    use tonic_health::pb::{HealthCheckRequest, health_client::HealthClient};
    let Ok(endpoint) = tonic::transport::Endpoint::from_shared(addr.to_string()) else {
        return false;
    };
    let check = async {
        let channel = endpoint.connect().await.ok()?;
        let response = HealthClient::new(channel)
            .check(HealthCheckRequest {
                service: SERVICE_NAME.into(),
            })
            .await
            .ok()?;
        Some(response.into_inner().status == ServingStatus::Serving as i32)
    };
    tokio::time::timeout(Duration::from_secs(2), check)
        .await
        .ok()
        .flatten()
        .unwrap_or(false)
}
