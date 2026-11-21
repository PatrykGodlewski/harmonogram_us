//! Drawing helpers shared by the documents. Coordinates follow pdf-lib (and the original
//! TypeScript layouts): `y` counts up from the bottom of the page.

use crate::fonts::FontFace;
use krilla::color::rgb;
use krilla::geom::{PathBuilder, Point};
use krilla::num::NormalizedF32;
use krilla::paint::{Fill, FillRule, Stroke};
use krilla::surface::Surface;
use krilla::text::TextDirection;

/// RGB colours of the brand navy and the secondary grey, as in the TypeScript PDFs.
pub type Rgb = (u8, u8, u8);
pub const NAVY: Rgb = (15, 41, 87);
pub const GREY: Rgb = (89, 97, 107);

/// A page of `width` × `height` points, for drawing with bottom-up coordinates.
#[derive(Clone, Copy)]
pub struct Page {
    pub width: f32,
    pub height: f32,
}

fn paint((r, g, b): Rgb) -> krilla::paint::Paint {
    rgb::Color::new(r, g, b).into()
}

impl Page {
    /// One line of text starting at `x`.
    pub fn text(
        self,
        surface: &mut Surface,
        text: &str,
        (x, y): (f32, f32),
        font: &FontFace,
        size: f32,
        color: Rgb,
    ) {
        surface.set_fill(Some(Fill {
            paint: paint(color),
            opacity: NormalizedF32::ONE,
            rule: FillRule::NonZero,
        }));
        surface.draw_text(
            Point::from_xy(x, self.height - y),
            font.pdf(),
            size,
            text,
            false,
            TextDirection::Auto,
        );
    }

    /// One line of text centred across the page.
    pub fn centered(
        self,
        surface: &mut Surface,
        text: &str,
        y: f32,
        font: &FontFace,
        size: f32,
        color: Rgb,
    ) {
        let x = (self.width - font.width(text, size)) / 2.0;
        self.text(surface, text, (x, y), font, size, color);
    }

    /// A straight line from (x1, y1) to (x2, y2).
    pub fn line(
        self,
        surface: &mut Surface,
        (x1, y1): (f32, f32),
        (x2, y2): (f32, f32),
        width: f32,
        color: Rgb,
    ) {
        let mut path = PathBuilder::new();
        path.move_to(x1, self.height - y1);
        path.line_to(x2, self.height - y2);
        let Some(path) = path.finish() else { return };
        surface.set_fill(None);
        surface.set_stroke(Some(Stroke {
            paint: paint(color),
            width,
            ..Default::default()
        }));
        surface.draw_path(&path);
        surface.set_stroke(None);
    }

    /// A rectangle outline with its bottom-left corner at (x, y).
    pub fn rect(
        self,
        surface: &mut Surface,
        (x, y): (f32, f32),
        (w, h): (f32, f32),
        width: f32,
        color: Rgb,
    ) {
        let mut path = PathBuilder::new();
        path.move_to(x, self.height - y);
        path.line_to(x + w, self.height - y);
        path.line_to(x + w, self.height - y - h);
        path.line_to(x, self.height - y - h);
        path.close();
        let Some(path) = path.finish() else { return };
        surface.set_fill(None);
        surface.set_stroke(Some(Stroke {
            paint: paint(color),
            width,
            ..Default::default()
        }));
        surface.draw_path(&path);
        surface.set_stroke(None);
    }
}
