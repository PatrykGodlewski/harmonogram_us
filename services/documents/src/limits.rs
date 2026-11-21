//! Input limits: they stop abuse; real data never comes near them.

use crate::proto::RenderTicketRequest;
use tonic::Status;

/// The most characters any text field may hold.
pub const MAX_TEXT_CHARS: usize = 2000;
/// The largest message accepted or sent, in bytes.
pub const MAX_MESSAGE_BYTES: usize = 64 * 1024 * 1024;

fn text(field: &str, value: &str) -> Result<(), Status> {
    if value.chars().count() > MAX_TEXT_CHARS {
        return Err(Status::invalid_argument(format!(
            "{field} is longer than {MAX_TEXT_CHARS} characters"
        )));
    }
    Ok(())
}

pub fn check_ticket(req: &RenderTicketRequest) -> Result<(), Status> {
    text("document_title", &req.document_title)?;
    text("heading", &req.heading)?;
    text("event_title", &req.event_title)?;
    text("date_text", &req.date_text)?;
    text("place", req.place.as_deref().unwrap_or_default())?;
    text("qr_text", &req.qr_text)?;
    text("show_at_entry", &req.show_at_entry)?;
    text("holder_label", &req.holder_label)?;
    text("holder_name", &req.holder_name)
}
