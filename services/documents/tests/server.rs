//! The real server on a random local port, called with the generated client.

use documents::admission::Admission;
use documents::config::Config;
use documents::proto::RenderTicketRequest;
use documents::proto::document_service_client::DocumentServiceClient;
use documents::{AppState, serve};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tonic::transport::Channel;
use tonic::{Code, Request};
use tonic_health::pb::HealthCheckRequest;
use tonic_health::pb::health_check_response::ServingStatus;
use tonic_health::pb::health_client::HealthClient;

const TOKEN: &str = "test-token-0123456789abcdef-0123456789";

struct Running {
    addr: String,
    stop: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<Result<(), tonic::transport::Error>>,
}

async fn start(admission: Admission) -> Running {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let config = Config {
        token: TOKEN.into(),
        grpc_addr: "127.0.0.1:0".parse().unwrap(),
        metrics_addr: "127.0.0.1:0".parse().unwrap(),
        metrics_token: None,
    };
    let (stop, stopped) = oneshot::channel::<()>();
    let state = AppState::new(&config, admission);
    let task = tokio::spawn(serve(listener, state, async {
        let _ = stopped.await;
    }));
    Running {
        addr,
        stop: Some(stop),
        task,
    }
}

async fn client(addr: &str) -> DocumentServiceClient<Channel> {
    DocumentServiceClient::connect(addr.to_string())
        .await
        .unwrap()
}

fn ticket() -> RenderTicketRequest {
    RenderTicketRequest {
        document_title: "Bilet — Koncert".into(),
        heading: "Bilet".into(),
        event_title: "Koncert".into(),
        date_text: "1 grudnia 2026, 18:00".into(),
        place: None,
        qr_text: "harmonogram-ticket:abc".into(),
        show_at_entry: "Pokaż przy wejściu".into(),
        holder_label: "Uczestnik".into(),
        holder_name: "Ala".into(),
    }
}

fn authorized<T>(message: T, token: &str) -> Request<T> {
    let mut request = Request::new(message);
    request
        .metadata_mut()
        .insert("authorization", format!("Bearer {token}").parse().unwrap());
    request
}

#[tokio::test]
async fn health_is_serving() {
    let server = start(Admission::new(2, 2)).await;
    let channel = Channel::from_shared(server.addr.clone())
        .unwrap()
        .connect()
        .await
        .unwrap();
    let mut health = HealthClient::new(channel);
    let response = health
        .check(HealthCheckRequest {
            service: "harmonogram.documents.v1.DocumentService".into(),
        })
        .await
        .unwrap();
    assert_eq!(response.into_inner().status, ServingStatus::Serving as i32);
}

#[tokio::test]
async fn missing_token_is_unauthenticated() {
    let server = start(Admission::new(2, 2)).await;
    let status = client(&server.addr)
        .await
        .render_ticket(ticket())
        .await
        .unwrap_err();
    assert_eq!(status.code(), Code::Unauthenticated);
}

#[tokio::test]
async fn token_off_by_last_byte_is_unauthenticated() {
    let server = start(Admission::new(2, 2)).await;
    let wrong = format!("{}X", &TOKEN[..TOKEN.len() - 1]);
    let status = client(&server.addr)
        .await
        .render_ticket(authorized(ticket(), &wrong))
        .await
        .unwrap_err();
    assert_eq!(status.code(), Code::Unauthenticated);
}

#[tokio::test]
async fn oversize_field_is_invalid_argument() {
    let server = start(Admission::new(2, 2)).await;
    let request = RenderTicketRequest {
        holder_name: "a".repeat(2001),
        ..ticket()
    };
    let status = client(&server.addr)
        .await
        .render_ticket(authorized(request, TOKEN))
        .await
        .unwrap_err();
    assert_eq!(status.code(), Code::InvalidArgument);
    assert!(
        status.message().contains("holder_name"),
        "{}",
        status.message()
    );
}

#[tokio::test]
async fn full_queue_is_resource_exhausted() {
    let server = start(Admission::new(0, 0)).await;
    let status = client(&server.addr)
        .await
        .render_ticket(authorized(ticket(), TOKEN))
        .await
        .unwrap_err();
    assert_eq!(status.code(), Code::ResourceExhausted);
}

#[tokio::test]
async fn renders_ticket() {
    let server = start(Admission::new(2, 2)).await;
    let pdf = client(&server.addr)
        .await
        .render_ticket(authorized(ticket(), TOKEN))
        .await
        .unwrap()
        .into_inner()
        .pdf;
    assert!(pdf.starts_with(b"%PDF"));
    drop(server);
}

impl Drop for Running {
    fn drop(&mut self) {
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
        self.task.abort();
    }
}
