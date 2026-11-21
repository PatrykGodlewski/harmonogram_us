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
    metrics_url: String,
    stop: Option<oneshot::Sender<()>>,
    task: tokio::task::JoinHandle<Result<(), tonic::transport::Error>>,
}

async fn start(admission: Admission) -> Running {
    start_with(admission, None).await
}

async fn start_with(admission: Admission, metrics_token: Option<&str>) -> Running {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let config = Config {
        token: TOKEN.into(),
        grpc_addr: "127.0.0.1:0".parse().unwrap(),
        metrics_addr: "127.0.0.1:0".parse().unwrap(),
        metrics_token: metrics_token.map(String::from),
    };
    let (stop, stopped) = oneshot::channel::<()>();
    let state = AppState::new(&config, admission);
    let metrics_listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let metrics_url = format!("http://{}/metrics", metrics_listener.local_addr().unwrap());
    let router = documents::metrics::router(state.metrics(), config.metrics_token.clone());
    tokio::spawn(async move { axum::serve(metrics_listener, router).await });
    let task = tokio::spawn(serve(listener, state, async {
        let _ = stopped.await;
    }));
    Running {
        addr,
        metrics_url,
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

async fn get(url: &str, token: Option<&str>) -> (u16, String) {
    let client = reqwest::Client::new();
    let mut request = client.get(url);
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request.send().await.unwrap();
    (response.status().as_u16(), response.text().await.unwrap())
}

#[tokio::test]
async fn metrics_hidden_without_token() {
    let server = start(Admission::new(2, 2)).await;
    assert_eq!(get(&server.metrics_url, None).await.0, 404);
}

#[tokio::test]
async fn metrics_need_bearer() {
    let server = start_with(Admission::new(2, 2), Some("metrics-secret")).await;
    assert_eq!(get(&server.metrics_url, None).await.0, 401);
    assert_eq!(get(&server.metrics_url, Some("wrong")).await.0, 401);
}

#[tokio::test]
async fn metrics_count_rpcs() {
    let server = start_with(Admission::new(2, 2), Some("metrics-secret")).await;
    client(&server.addr)
        .await
        .render_ticket(authorized(ticket(), TOKEN))
        .await
        .unwrap();
    let (status, body) = get(&server.metrics_url, Some("metrics-secret")).await;
    assert_eq!(status, 200);
    assert!(
        body.contains(r#"documents_rpc_requests_total{method="RenderTicket",code="ok"} 1"#),
        "{body}"
    );
    assert!(body.contains("documents_rpc_duration_seconds"), "{body}");
    assert!(body.contains("documents_render_queue_depth 0"), "{body}");
}

#[tokio::test]
async fn health_probe_reports_serving() {
    let server = start(Admission::new(2, 2)).await;
    assert!(documents::health_probe(&server.addr).await);
    assert!(!documents::health_probe("http://127.0.0.1:1").await);
}

#[tokio::test]
async fn shutdown_stops_serving() {
    let mut server = start(Admission::new(2, 2)).await;
    let _ = server.stop.take().unwrap().send(());
    let result = tokio::time::timeout(std::time::Duration::from_secs(10), &mut server.task)
        .await
        .expect("serve returns within 10 s")
        .unwrap();
    assert!(result.is_ok());
    assert!(
        DocumentServiceClient::connect(server.addr.clone())
            .await
            .is_err()
    );
}

impl Drop for Running {
    fn drop(&mut self) {
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
        self.task.abort();
    }
}
