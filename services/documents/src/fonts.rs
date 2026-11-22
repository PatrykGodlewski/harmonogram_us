//! The app's fonts (Noto Sans, OFL; see `assets/fonts/OFL.txt`), embedded in the binary.

use std::sync::Arc;

static REGULAR: &[u8] = include_bytes!("../assets/fonts/NotoSans-Regular.ttf");
static BOLD: &[u8] = include_bytes!("../assets/fonts/NotoSans-Bold.ttf");

/// One font face: its file and the advance widths used to lay out text.
pub struct FontFace {
    face: ttf_parser::Face<'static>,
    pdf: krilla::text::Font,
}

impl FontFace {
    fn parse(bytes: &'static [u8]) -> Self {
        let face = ttf_parser::Face::parse(bytes, 0).expect("embedded font is valid");
        let data: Arc<dyn AsRef<[u8]> + Send + Sync> = Arc::new(bytes);
        let pdf = krilla::text::Font::new(data.into(), 0).expect("embedded font is valid");
        Self { face, pdf }
    }

    /// The font for drawing (krilla embeds the glyphs used, subset).
    pub fn pdf(&self) -> krilla::text::Font {
        self.pdf.clone()
    }

    /// Width of `text` at `size` points (sum of advances, no kerning, like pdf-lib).
    /// Characters the font lacks are drawn as its "missing" box (glyph 0) and measured so.
    pub fn width(&self, text: &str, size: f32) -> f32 {
        let units: u32 = text
            .chars()
            .map(|ch| {
                let glyph = self.face.glyph_index(ch).unwrap_or(ttf_parser::GlyphId(0));
                self.face.glyph_hor_advance(glyph).map_or(0, u32::from)
            })
            .sum();
        units as f32 * size / f32::from(self.face.units_per_em())
    }
}

/// Regular and bold Noto Sans.
pub struct Fonts {
    pub regular: FontFace,
    pub bold: FontFace,
}

impl Fonts {
    pub fn load() -> Self {
        Self {
            regular: FontFace::parse(REGULAR),
            bold: FontFace::parse(BOLD),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polish_letters_have_width() {
        let fonts = Fonts::load();
        let short = fonts.regular.width("Za", 12.0);
        let long = fonts.regular.width("Zażółć", 12.0);
        assert!(short > 0.0);
        assert!(long > short * 2.0);
    }

    #[test]
    fn missing_glyphs_take_space() {
        // Noto Sans has no CJK or emoji: they are drawn as boxes and must be measured too.
        let fonts = Fonts::load();
        assert!(fonts.regular.width("漢字", 12.0) > fonts.regular.width("a", 12.0));
    }

    #[test]
    fn bold_is_wider() {
        let fonts = Fonts::load();
        assert!(fonts.bold.width("Koncert", 12.0) > fonts.regular.width("Koncert", 12.0));
    }
}
