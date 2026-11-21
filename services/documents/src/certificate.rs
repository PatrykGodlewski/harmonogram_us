//! The attendance certificate: a port of `packages/api/src/certificates/pdf.ts`.

use crate::draw::{GREY, NAVY, Page};
use crate::fonts::Fonts;
use crate::layout::fit_lines;
use crate::proto::RenderCertificateRequest;
use krilla::Document;
use krilla::metadata::Metadata;
use krilla::page::PageSettings;

/// A4 landscape, in PDF points.
const PAGE: Page = Page {
    width: 842.0,
    height: 595.0,
};
/// Text stays inside the border with a margin.
const TEXT_WIDTH: f32 = 842.0 - 160.0;
const SIGNER_WIDTH: f32 = 260.0;

fn present(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|value| !value.is_empty())
}

/// One page confirming that the person attended the event.
pub fn render(req: &RenderCertificateRequest, fonts: &Fonts) -> Vec<u8> {
    let mut document = Document::new();
    document.set_metadata(Metadata::new().title(req.document_title.clone()));
    let mut page = document.start_page_with(
        PageSettings::from_wh(PAGE.width, PAGE.height).expect("the A4 size is valid"),
    );
    let mut surface = page.surface();
    let s = &mut surface;
    let (regular, bold) = (&fonts.regular, &fonts.bold);
    let by_regular = |text: &str, size| regular.width(text, size);
    let by_bold = |text: &str, size| bold.width(text, size);

    PAGE.rect(
        s,
        (24.0, 24.0),
        (PAGE.width - 48.0, PAGE.height - 48.0),
        2.0,
        NAVY,
    );
    if let Some(issuer) = present(&req.issuer) {
        let issuer = fit_lines(issuer, by_regular, TEXT_WIDTH, &[13.0, 11.0], 1);
        let line = issuer.lines.first().map_or("", String::as_str);
        PAGE.centered(s, line, 515.0, regular, issuer.size, GREY);
    }
    let mut y = 470.0;
    PAGE.centered(s, &req.title, y, bold, 34.0, NAVY);
    y -= 56.0;
    PAGE.centered(s, &req.person_label, y, regular, 13.0, GREY);
    y -= 34.0;
    // A name is never cut while it fits: it shrinks, then takes a second line.
    let name = fit_lines(&req.name, by_bold, TEXT_WIDTH, &[26.0, 22.0, 18.0, 14.0], 2);
    for (index, line) in name.lines.iter().enumerate() {
        if index > 0 {
            y -= name.size + 6.0;
        }
        PAGE.centered(s, line, y, bold, name.size, NAVY);
    }
    y -= 46.0;
    PAGE.centered(s, &req.intro, y, regular, 13.0, GREY);
    // At most three lines, so the date never reaches the footer.
    let title = fit_lines(
        &req.event_title,
        by_bold,
        TEXT_WIDTH,
        &[20.0, 17.0, 14.0],
        3,
    );
    for line in &title.lines {
        y -= title.size + 10.0;
        PAGE.centered(s, line, y, bold, title.size, NAVY);
    }
    y -= 40.0;
    PAGE.centered(s, &req.date_line, y, regular, 14.0, NAVY);
    if let Some(note) = present(&req.note) {
        let note = fit_lines(note, by_regular, TEXT_WIDTH, &[12.0, 10.0], 1);
        let line = note.lines.first().map_or("", String::as_str);
        PAGE.centered(s, line, y - 22.0, regular, note.size, NAVY);
    }
    if let Some(signer) = present(&req.signer) {
        // A line to sign above the signer's name, bottom right.
        let signer = fit_lines(signer, by_regular, SIGNER_WIDTH, &[11.0, 9.0], 1);
        let right = PAGE.width - 80.0;
        PAGE.line(s, (right - SIGNER_WIDTH, 104.0), (right, 104.0), 0.75, GREY);
        let text = signer.lines.first().map_or("", String::as_str);
        let x = right - regular.width(text, signer.size);
        PAGE.text(s, text, (x, 88.0), regular, signer.size, NAVY);
    }
    PAGE.centered(s, &req.footer, 52.0, regular, 10.0, GREY);

    surface.finish();
    page.finish();
    document
        .finish()
        .expect("a certificate with embedded fonts serialises")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> RenderCertificateRequest {
        RenderCertificateRequest {
            document_title: "Zaświadczenie o udziale — Warsztaty".into(),
            issuer: Some("Wydział Nauk Ścisłych".into()),
            title: "Zaświadczenie o udziale".into(),
            person_label: "Zaświadcza się, że".into(),
            name: "Zażółć Gęślą Jaźń".into(),
            intro: "uczestniczył(a) w wydarzeniu".into(),
            event_title: "Warsztaty łączności".into(),
            date_line: "Data: 1 grudnia 2026".into(),
            note: Some("Liczba godzin: 4".into()),
            signer: Some("dr Jan Nowak".into()),
            footer: "Nr AB12CD34".into(),
        }
    }

    #[test]
    fn one_a4_landscape_page() {
        let pdf = render(&request(), &Fonts::load());
        let doc = lopdf::Document::load_mem(&pdf).unwrap();
        let pages = doc.get_pages();
        assert_eq!(pages.len(), 1);
        let page = doc.get_dictionary(*pages.values().next().unwrap()).unwrap();
        let media_box: Vec<f32> = page
            .get(b"MediaBox")
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .map(|n| n.as_float().unwrap())
            .collect();
        assert_eq!(media_box, vec![0.0, 0.0, 842.0, 595.0]);
        let info = doc.trailer.get(b"Info").unwrap().as_reference().unwrap();
        let title = doc.get_dictionary(info).unwrap().get(b"Title").unwrap();
        assert_eq!(
            lopdf::decode_text_string(title).unwrap(),
            "Zaświadczenie o udziale — Warsztaty"
        );
    }

    #[test]
    fn renders_without_optional_lines() {
        let req = RenderCertificateRequest {
            issuer: None,
            note: None,
            signer: None,
            ..request()
        };
        assert!(lopdf::Document::load_mem(&render(&req, &Fonts::load())).is_ok());
    }

    #[test]
    fn renders_extreme_text() {
        let req = RenderCertificateRequest {
            name: "W".repeat(2000),
            event_title: "słowo ".repeat(333),
            signer: Some("漢".repeat(500)),
            ..request()
        };
        assert!(lopdf::Document::load_mem(&render(&req, &Fonts::load())).is_ok());
    }
}
