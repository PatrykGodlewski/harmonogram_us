//! Input limits: they stop abuse; real data never comes near them.

use crate::proto::{RenderAttendanceSheetRequest, RenderCertificateRequest, RenderTicketRequest};
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

pub fn check_certificate(req: &RenderCertificateRequest) -> Result<(), Status> {
    text("document_title", &req.document_title)?;
    text("issuer", req.issuer.as_deref().unwrap_or_default())?;
    text("title", &req.title)?;
    text("person_label", &req.person_label)?;
    text("name", &req.name)?;
    text("intro", &req.intro)?;
    text("event_title", &req.event_title)?;
    text("date_line", &req.date_line)?;
    text("note", req.note.as_deref().unwrap_or_default())?;
    text("signer", req.signer.as_deref().unwrap_or_default())?;
    text("footer", &req.footer)
}

pub fn check_sheet(req: &RenderAttendanceSheetRequest) -> Result<(), Status> {
    text("document_title", &req.document_title)?;
    text("title", &req.title)?;
    text("event_title", &req.event_title)?;
    text("date_text", &req.date_text)?;
    text("no_label", &req.no_label)?;
    text("name_label", &req.name_label)?;
    text("email_label", &req.email_label)?;
    text("signature_label", &req.signature_label)?;
    text("page_label_template", &req.page_label_template)?;
    for (index, person) in req.people.iter().enumerate() {
        text(&format!("people[{index}].name"), &person.name)?;
        text(&format!("people[{index}].email"), &person.email)?;
    }
    Ok(())
}
