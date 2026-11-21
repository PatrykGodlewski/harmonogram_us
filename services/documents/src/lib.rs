//! The documents service: renders the app's PDFs over gRPC.
#![forbid(unsafe_code)]

pub mod admission;
mod auth;
pub mod config;
pub mod fonts;
pub mod layout;
mod limits;
pub mod qr;
mod service;
pub mod ticket;

/// Generated from `proto/harmonogram/documents/v1/documents.proto`.
pub mod proto {
    tonic::include_proto!("harmonogram.documents.v1");
}

use admission::Admission;
use config::Config;
use fonts::Fonts;
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
}

impl AppState {
    pub fn new(config: &Config, admission: Admission) -> Self {
        Self {
            token: config.token.as_str().into(),
            documents: Documents {
                fonts: Arc::new(Fonts::load()),
                admission,
            },
        }
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
    let documents = DocumentServiceServer::new(state.documents)
        .max_decoding_message_size(limits::MAX_MESSAGE_BYTES)
        .max_encoding_message_size(limits::MAX_MESSAGE_BYTES);
    let documents = InterceptedService::new(documents, move |request: tonic::Request<()>| {
        auth::check(request.metadata(), &token).map(|()| request)
    });
    Server::builder()
        .add_service(health_service)
        .add_service(documents)
        .serve_with_incoming_shutdown(TcpListenerStream::new(listener), shutdown)
        .await
}
