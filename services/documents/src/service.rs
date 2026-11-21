//! The `DocumentService` implementation.

use crate::admission::Admission;
use crate::fonts::Fonts;
use crate::metrics::Metrics;
use crate::proto::document_service_server::DocumentService;
use crate::proto::{
    RenderAttendanceSheetRequest, RenderAttendanceSheetResponse, RenderCertificateRequest,
    RenderCertificateResponse, RenderTicketRequest, RenderTicketResponse,
};
use crate::{certificate, limits, sheet, ticket};
use std::sync::Arc;
use std::time::Instant;
use tonic::{Request, Response, Status};

pub struct Documents {
    pub(crate) fonts: Arc<Fonts>,
    pub(crate) admission: Admission,
    pub(crate) metrics: Arc<Metrics>,
}

impl Documents {
    /// Takes a place in the pool and renders on the blocking pool.
    async fn render<R: Send + 'static>(
        &self,
        req: R,
        draw: fn(&R, &Fonts) -> Vec<u8>,
    ) -> Result<Vec<u8>, Status> {
        let place = self
            .admission
            .try_enter()
            .ok_or_else(|| Status::resource_exhausted("too many documents in progress"))?;
        let fonts = self.fonts.clone();
        Ok(place.run(move || draw(&req, &fonts)).await)
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
        let req = request.into_inner();
        let result = match limits::check_ticket(&req) {
            Ok(()) => self.render(req, ticket::render).await,
            Err(status) => Err(status),
        }
        .map(|pdf| RenderTicketResponse { pdf });
        self.record("RenderTicket", started, &result);
        result.map(Response::new)
    }

    async fn render_certificate(
        &self,
        request: Request<RenderCertificateRequest>,
    ) -> Result<Response<RenderCertificateResponse>, Status> {
        let started = Instant::now();
        let req = request.into_inner();
        let result = match limits::check_certificate(&req) {
            Ok(()) => self.render(req, certificate::render).await,
            Err(status) => Err(status),
        }
        .map(|pdf| RenderCertificateResponse { pdf });
        self.record("RenderCertificate", started, &result);
        result.map(Response::new)
    }

    async fn render_attendance_sheet(
        &self,
        request: Request<RenderAttendanceSheetRequest>,
    ) -> Result<Response<RenderAttendanceSheetResponse>, Status> {
        let started = Instant::now();
        let req = request.into_inner();
        let result = match limits::check_sheet(&req) {
            Ok(()) => self.render(req, sheet::render).await,
            Err(status) => Err(status),
        }
        .map(|pdf| RenderAttendanceSheetResponse { pdf });
        self.record("RenderAttendanceSheet", started, &result);
        result.map(Response::new)
    }
}
