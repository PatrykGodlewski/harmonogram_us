//! The plain-HTTP side port: Prometheus metrics behind `METRICS_TOKEN` like the apps'
//! `/api/metrics` (unset: 404), and `/healthz` for platforms whose health checks speak only
//! HTTP (Railway). Labels never carry names, IDs or other request data.

use axum::Router;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use prometheus_client::encoding::EncodeLabelSet;
use prometheus_client::encoding::text::encode;
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::family::Family;
use prometheus_client::metrics::gauge::Gauge;
use prometheus_client::metrics::histogram::{Histogram, exponential_buckets};
use prometheus_client::registry::Registry;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use subtle::ConstantTimeEq;

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct CallLabels {
    method: &'static str,
    code: &'static str,
}

#[derive(Clone, Debug, Hash, PartialEq, Eq, EncodeLabelSet)]
struct MethodLabels {
    method: &'static str,
}

pub struct Metrics {
    registry: Registry,
    requests: Family<CallLabels, Counter>,
    durations: Family<MethodLabels, Histogram>,
}

impl Metrics {
    /// Registers the RPC metrics and `queue_depth` (requests rendering or waiting).
    pub fn new(queue_depth: Gauge) -> Self {
        let mut registry = Registry::default();
        let requests = Family::<CallLabels, Counter>::default();
        // 1 ms to ~16 s.
        let durations = Family::<MethodLabels, Histogram>::new_with_constructor(|| {
            Histogram::new(exponential_buckets(0.001, 2.0, 15))
        });
        registry.register(
            "documents_rpc_requests",
            "RPCs by method and status code",
            requests.clone(),
        );
        registry.register(
            "documents_rpc_duration_seconds",
            "RPC duration",
            durations.clone(),
        );
        registry.register(
            "documents_render_queue_depth",
            "Documents rendering or waiting",
            queue_depth,
        );
        Self {
            registry,
            requests,
            durations,
        }
    }

    pub fn observe(&self, method: &'static str, code: tonic::Code, elapsed: Duration) {
        self.requests
            .get_or_create(&CallLabels {
                method,
                code: code_label(code),
            })
            .inc();
        self.durations
            .get_or_create(&MethodLabels { method })
            .observe(elapsed.as_secs_f64());
    }

    fn encode(&self) -> String {
        let mut body = String::new();
        encode(&mut body, &self.registry).expect("writing to a String cannot fail");
        body
    }
}

/// The gRPC status code as a label, e.g. `ok`, `invalid_argument`.
pub fn code_label(code: tonic::Code) -> &'static str {
    use tonic::Code::*;
    match code {
        Ok => "ok",
        Cancelled => "cancelled",
        Unknown => "unknown",
        InvalidArgument => "invalid_argument",
        DeadlineExceeded => "deadline_exceeded",
        NotFound => "not_found",
        AlreadyExists => "already_exists",
        PermissionDenied => "permission_denied",
        ResourceExhausted => "resource_exhausted",
        FailedPrecondition => "failed_precondition",
        Aborted => "aborted",
        OutOfRange => "out_of_range",
        Unimplemented => "unimplemented",
        Internal => "internal",
        Unavailable => "unavailable",
        DataLoss => "data_loss",
        Unauthenticated => "unauthenticated",
    }
}

/// Whether the gRPC server is serving: set once it listens, cleared when shutdown begins.
pub type Readiness = Arc<AtomicBool>;

type MetricsState = (Arc<Metrics>, Option<Arc<str>>);

/// `GET /metrics` and `GET /healthz`.
pub fn router(metrics: Arc<Metrics>, token: Option<String>, readiness: Readiness) -> Router {
    Router::new()
        .route("/metrics", get(scrape))
        .with_state((metrics, token.map(Arc::from)))
        .route("/healthz", get(move || healthz(readiness.clone())))
}

/// 200 `ok` while serving; 503 before start-up and once shutdown begins. No token: it says
/// nothing an outsider could use.
async fn healthz(readiness: Readiness) -> Response {
    if readiness.load(Ordering::Relaxed) {
        (StatusCode::OK, "ok").into_response()
    } else {
        StatusCode::SERVICE_UNAVAILABLE.into_response()
    }
}

async fn scrape(State((metrics, token)): State<MetricsState>, headers: HeaderMap) -> Response {
    let Some(token) = token else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let sent = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default();
    if !bool::from(sent.as_bytes().ct_eq(token.as_bytes())) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    (
        [(
            header::CONTENT_TYPE,
            "application/openmetrics-text; version=1.0.0; charset=utf-8",
        )],
        metrics.encode(),
    )
        .into_response()
}
