//! The printable attendance sheet: a port of `packages/api/src/admin/attendance-sheet-pdf.ts`.

use crate::draw::{GREY, NAVY, Page, Rgb};
use crate::fonts::{FontFace, Fonts};
use crate::layout::fit_lines;
use crate::proto::RenderAttendanceSheetRequest;
use krilla::Document;
use krilla::metadata::Metadata;
use krilla::page::PageSettings;
use krilla::surface::Surface;

/// A4 portrait, in PDF points.
const PAGE: Page = Page {
    width: 595.0,
    height: 842.0,
};
const MARGIN: f32 = 40.0;
const ROW_HEIGHT: f32 = 28.0;
const FIRST_PAGE_ROWS: usize = 24;
const PAGE_ROWS: usize = 27;
/// Column x positions: no., name, e-mail, signature.
const COL_NO: f32 = MARGIN;
const COL_NAME: f32 = MARGIN + 30.0;
const COL_EMAIL: f32 = MARGIN + 210.0;
const COL_SIGNATURE: f32 = MARGIN + 390.0;
const ROW_LINE: Rgb = (204, 209, 217);

/// Rows per page: the first page holds fewer (the title sits above the table).
pub fn page_rows(total: usize, first: usize, per_page: usize) -> Vec<usize> {
    if total <= first {
        return vec![total];
    }
    let mut pages = vec![first];
    let mut left = total - first;
    while left > 0 {
        let rows = left.min(per_page);
        pages.push(rows);
        left -= rows;
    }
    pages
}

/// The page footer: the caller's translated template with the numbers filled in.
pub fn page_label(template: &str, page: usize, pages: usize) -> String {
    template
        .replace("{pages}", &pages.to_string())
        .replace("{page}", &page.to_string())
}

/// One line in a column: the largest size that fits (drawn at that size).
fn cell(
    surface: &mut Surface,
    text: &str,
    (x, y): (f32, f32),
    width: f32,
    sizes: &[f32],
    font: &FontFace,
    color: Rgb,
) {
    let fitted = fit_lines(text, |t: &str, size| font.width(t, size), width, sizes, 1);
    let line = fitted.lines.first().map_or("", String::as_str);
    PAGE.text(surface, line, (x, y), font, fitted.size, color);
}

/// Everyone with a place, one row each, with an empty box to sign.
pub fn render(req: &RenderAttendanceSheetRequest, fonts: &Fonts) -> Vec<u8> {
    let (regular, bold) = (&fonts.regular, &fonts.bold);
    let mut document = Document::new();
    document.set_metadata(Metadata::new().title(req.document_title.clone()));
    let pages = page_rows(req.people.len(), FIRST_PAGE_ROWS, PAGE_ROWS);
    let mut people = req.people.iter().enumerate();

    for (page_index, &rows) in pages.iter().enumerate() {
        let mut page = document.start_page_with(
            PageSettings::from_wh(PAGE.width, PAGE.height).expect("the A4 size is valid"),
        );
        let mut surface = page.surface();
        let s = &mut surface;
        let mut y = PAGE.height - MARGIN;
        if page_index == 0 {
            PAGE.text(s, &req.title, (MARGIN, y), bold, 18.0, NAVY);
            let title = fit_lines(
                &req.event_title,
                |t: &str, size| bold.width(t, size),
                PAGE.width - 2.0 * MARGIN,
                &[13.0, 11.0],
                2,
            );
            for line in &title.lines {
                y -= 18.0;
                PAGE.text(s, line, (MARGIN, y), bold, title.size, NAVY);
            }
            y -= 16.0;
            PAGE.text(s, &req.date_text, (MARGIN, y), regular, 10.0, GREY);
            y -= 28.0;
        }
        for (label, x) in [
            (&req.no_label, COL_NO),
            (&req.name_label, COL_NAME),
            (&req.email_label, COL_EMAIL),
            (&req.signature_label, COL_SIGNATURE),
        ] {
            PAGE.text(s, label, (x, y), bold, 9.0, GREY);
        }
        y -= 8.0;
        PAGE.line(s, (MARGIN, y), (PAGE.width - MARGIN, y), 1.0, GREY);
        for (index, person) in people.by_ref().take(rows) {
            let text_y = y - 18.0;
            PAGE.text(
                s,
                &(index + 1).to_string(),
                (COL_NO, text_y),
                regular,
                10.0,
                NAVY,
            );
            let name_width = COL_EMAIL - COL_NAME - 8.0;
            cell(
                s,
                &person.name,
                (COL_NAME, text_y),
                name_width,
                &[10.0, 9.0, 8.0],
                regular,
                NAVY,
            );
            let email_width = COL_SIGNATURE - COL_EMAIL - 8.0;
            cell(
                s,
                &person.email,
                (COL_EMAIL, text_y),
                email_width,
                &[9.0, 8.0],
                regular,
                GREY,
            );
            y -= ROW_HEIGHT;
            PAGE.line(s, (MARGIN, y), (PAGE.width - MARGIN, y), 0.5, ROW_LINE);
        }
        let footer = page_label(&req.page_label_template, page_index + 1, pages.len());
        PAGE.text(s, &footer, (MARGIN, MARGIN / 2.0), regular, 8.0, GREY);
        surface.finish();
        page.finish();
    }
    document
        .finish()
        .expect("an attendance sheet with embedded fonts serialises")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::Person;

    fn request(people: usize) -> RenderAttendanceSheetRequest {
        RenderAttendanceSheetRequest {
            document_title: "Lista obecności — Warsztaty".into(),
            title: "Lista obecności".into(),
            event_title: "Warsztaty".into(),
            date_text: "1 grudnia 2026, 10:00".into(),
            no_label: "Lp.".into(),
            name_label: "Imię i nazwisko".into(),
            email_label: "E-mail".into(),
            signature_label: "Podpis".into(),
            page_label_template: "Strona {page} z {pages}".into(),
            people: (0..people)
                .map(|index| Person {
                    name: format!("Osoba {index} Żółć"),
                    email: format!("o{index}@x.test"),
                })
                .collect(),
        }
    }

    fn pages(pdf: &[u8]) -> Vec<Vec<f32>> {
        let doc = lopdf::Document::load_mem(pdf).unwrap();
        doc.get_pages()
            .values()
            .map(|id| {
                doc.get_dictionary(*id)
                    .unwrap()
                    .get(b"MediaBox")
                    .unwrap()
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|n| n.as_float().unwrap())
                    .collect()
            })
            .collect()
    }

    #[test]
    fn page_rows_split() {
        assert_eq!(page_rows(60, 20, 25), vec![20, 25, 15]);
        assert_eq!(page_rows(0, 20, 25), vec![0]);
        assert_eq!(page_rows(24, 24, 27), vec![24]);
        assert_eq!(page_rows(25, 24, 27), vec![24, 1]);
    }

    #[test]
    fn page_label_fills_placeholders() {
        assert_eq!(page_label("Strona {page} z {pages}", 2, 3), "Strona 2 z 3");
        assert_eq!(page_label("Page {page} of {pages}", 1, 1), "Page 1 of 1");
    }

    #[test]
    fn empty_sheet_has_one_page() {
        let pdf = render(&request(0), &Fonts::load());
        assert_eq!(pages(&pdf), vec![vec![0.0, 0.0, 595.0, 842.0]]);
    }

    #[test]
    fn long_sheet_pages() {
        let fonts = Fonts::load();
        assert_eq!(pages(&render(&request(45), &fonts)).len(), 2);
        assert_eq!(
            pages(&render(&request(2000), &fonts)).len(),
            page_rows(2000, 24, 27).len()
        );
    }
}
