//! The `DocumentService` implementation.

use crate::admission::Admission;
use crate::fonts::Fonts;
use crate::metrics::Metrics;
use crate::proto::document_service_server::DocumentService;
use crate::proto::{RenderTicketRequest, RenderTicketResponse};
use crate::{limits, ticket};
use std::sync::Arc;
use std::time::Instant;
use tonic::{Request, Response, Status};

pub struct Documents {
    pub(crate) fonts: Arc<Fonts>,
    pub(crate) admission: Admission,
    pub(crate) metrics: Arc<Metrics>,
}

impl Documents {
    async fn ticket(&self, req: RenderTicketRequest) -> Result<RenderTicketResponse, Status> {
        limits::check_ticket(&req)?;
        let place = self
            .admission
            .try_enter()
            .ok_or_else(|| Status::resource_exhausted("too many documents in progress"))?;
        let fonts = self.fonts.clone();
        let pdf = place.run(move || ticket::render(&req, &fonts)).await;
        Ok(RenderTicketResponse { pdf })
    }

    /// One metric sample and one log line per call; never the request's contents.
    fn record<T>(&self, method: &'static str, started: Instant, result: &Result<T, Status>) {
        let code = result
            .as_ref()
            .map_or_else(Status::code, |_| tonic::Code::Ok);
        let elapsed = started.elapsed();
        self.metrics.observe(method, code, elapsed);
        tracing::info!(
            method,
            code = crate::metrics::code_label(code),
            duration_ms = elapsed.as_secs_f64() * 1000.0,
            "rpc"
        );
    }
}

#[tonic::async_trait]
impl DocumentService for Documents {
    async fn render_ticket(
        &self,
        request: Request<RenderTicketRequest>,
    ) -> Result<Response<RenderTicketResponse>, Status> {
        let started = Instant::now();
        let result = self.ticket(request.into_inner()).await;
        self.record("RenderTicket", started, &result);
        result.map(Response::new)
    }
}
