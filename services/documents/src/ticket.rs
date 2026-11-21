//! The printable ticket: a port of `packages/api/src/tickets/pdf.ts`.

use crate::fonts::{FontFace, Fonts};
use crate::layout::fit_lines;
use crate::proto::RenderTicketRequest;
use crate::qr;
use krilla::Document;
use krilla::color::rgb;
use krilla::geom::{Point, Size, Transform};
use krilla::image::Image;
use krilla::metadata::Metadata;
use krilla::num::NormalizedF32;
use krilla::page::PageSettings;
use krilla::paint::{Fill, FillRule};
use krilla::surface::Surface;
use krilla::text::TextDirection;

/// A6 portrait (a phone-sized card), in PDF points.
const WIDTH: f32 = 298.0;
const HEIGHT: f32 = 420.0;
const TEXT_WIDTH: f32 = WIDTH - 40.0;
const QR_SIZE: f32 = 150.0;

/// RGB of the brand navy and the secondary grey, as in the TypeScript PDFs.
const NAVY: (u8, u8, u8) = (15, 41, 87);
const GREY: (u8, u8, u8) = (89, 97, 107);

/// Draws one line centred across the page; `y` counts up from the bottom, as in pdf-lib.
fn centered(
    surface: &mut Surface,
    text: &str,
    y: f32,
    font: &FontFace,
    size: f32,
    (r, g, b): (u8, u8, u8),
) {
    surface.set_fill(Some(Fill {
        paint: rgb::Color::new(r, g, b).into(),
        opacity: NormalizedF32::ONE,
        rule: FillRule::NonZero,
    }));
    let x = (WIDTH - font.width(text, size)) / 2.0;
    surface.draw_text(
        Point::from_xy(x, HEIGHT - y),
        font.pdf(),
        size,
        text,
        false,
        TextDirection::Auto,
    );
}

/// One page: event, holder and the QR code the door scanner reads.
pub fn render(req: &RenderTicketRequest, fonts: &Fonts) -> Vec<u8> {
    let mut document = Document::new();
    document.set_metadata(Metadata::new().title(req.document_title.clone()));
    let mut page = document
        .start_page_with(PageSettings::from_wh(WIDTH, HEIGHT).expect("the A6 size is valid"));
    let mut surface = page.surface();
    let (regular, bold) = (&fonts.regular, &fonts.bold);

    let mut y = HEIGHT - 36.0;
    centered(&mut surface, &req.heading, y, regular, 11.0, GREY);
    let title = fit_lines(
        &req.event_title,
        |text: &str, size| bold.width(text, size),
        TEXT_WIDTH,
        &[16.0, 14.0, 12.0],
        2,
    );
    for line in &title.lines {
        y -= title.size + 6.0;
        centered(&mut surface, line, y, bold, title.size, NAVY);
    }
    y -= 18.0;
    centered(&mut surface, &req.date_text, y, regular, 10.0, NAVY);
    if let Some(place) = req.place.as_deref().filter(|place| !place.is_empty()) {
        y -= 14.0;
        let place = fit_lines(
            place,
            |text: &str, size| regular.width(text, size),
            TEXT_WIDTH,
            &[10.0, 9.0],
            1,
        );
        let line = place.lines.first().map_or("", String::as_str);
        centered(&mut surface, line, y, regular, place.size, NAVY);
    }

    y -= QR_SIZE + 14.0;
    let image = Image::from_png(qr::png(&req.qr_text).into(), false)
        .expect("the QR PNG we just encoded is valid");
    surface.push_transform(&Transform::from_translate(
        (WIDTH - QR_SIZE) / 2.0,
        HEIGHT - y - QR_SIZE,
    ));
    surface.draw_image(image, Size::from_wh(QR_SIZE, QR_SIZE).expect("valid size"));
    surface.pop();
    y -= 16.0;
    centered(&mut surface, &req.show_at_entry, y, regular, 9.0, GREY);

    y -= 22.0;
    centered(&mut surface, &req.holder_label, y, regular, 9.0, GREY);
    y -= 14.0;
    let holder = fit_lines(
        &req.holder_name,
        |text: &str, size| bold.width(text, size),
        TEXT_WIDTH,
        &[12.0, 10.0],
        1,
    );
    let line = holder.lines.first().map_or("", String::as_str);
    centered(&mut surface, line, y, bold, holder.size, NAVY);

    surface.finish();
    page.finish();
    document
        .finish()
        .expect("a ticket with embedded fonts serialises")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> RenderTicketRequest {
        RenderTicketRequest {
            document_title: "Bilet — Koncert jesienny".into(),
            heading: "Bilet".into(),
            event_title: "Koncert jesienny".into(),
            date_text: "1 grudnia 2026, 18:00".into(),
            place: Some("Aula · B105".into()),
            qr_text: format!("harmonogram-ticket:{}", "a".repeat(64)),
            show_at_entry: "Pokaż przy wejściu".into(),
            holder_label: "Uczestnik".into(),
            holder_name: "Zażółć Gęślą".into(),
        }
    }

    #[test]
    fn one_a6_page() {
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
        assert_eq!(media_box, vec![0.0, 0.0, 298.0, 420.0]);
        let info = doc.trailer.get(b"Info").unwrap().as_reference().unwrap();
        let title = doc.get_dictionary(info).unwrap().get(b"Title").unwrap();
        assert_eq!(
            lopdf::decode_text_string(title).unwrap(),
            "Bilet — Koncert jesienny"
        );
    }

    #[test]
    fn renders_extreme_text() {
        let req = RenderTicketRequest {
            event_title: "W".repeat(300),
            place: None,
            ..request()
        };
        let pdf = render(&req, &Fonts::load());
        assert!(lopdf::Document::load_mem(&pdf).is_ok());
    }
}
