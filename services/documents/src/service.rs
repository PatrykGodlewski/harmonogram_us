//! The `DocumentService` implementation.

use crate::admission::Admission;
use crate::fonts::Fonts;
use crate::proto::document_service_server::DocumentService;
use crate::proto::{RenderTicketRequest, RenderTicketResponse};
use crate::{limits, ticket};
use std::sync::Arc;
use tonic::{Request, Response, Status};

pub struct Documents {
    pub(crate) fonts: Arc<Fonts>,
    pub(crate) admission: Admission,
}

#[tonic::async_trait]
impl DocumentService for Documents {
    async fn render_ticket(
        &self,
        request: Request<RenderTicketRequest>,
    ) -> Result<Response<RenderTicketResponse>, Status> {
        let req = request.into_inner();
        limits::check_ticket(&req)?;
        let place = self
            .admission
            .try_enter()
            .ok_or_else(|| Status::resource_exhausted("too many documents in progress"))?;
        let fonts = self.fonts.clone();
        let pdf = place.run(move || ticket::render(&req, &fonts)).await;
        Ok(Response::new(RenderTicketResponse { pdf }))
    }
}
