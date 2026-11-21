//! The app's fonts (Noto Sans, OFL; see `assets/fonts/OFL.txt`), embedded in the binary.

static REGULAR: &[u8] = include_bytes!("../assets/fonts/NotoSans-Regular.ttf");
static BOLD: &[u8] = include_bytes!("../assets/fonts/NotoSans-Bold.ttf");

/// One font face: its file and the advance widths used to lay out text.
pub struct FontFace {
    bytes: &'static [u8],
    face: ttf_parser::Face<'static>,
}

impl FontFace {
    fn parse(bytes: &'static [u8]) -> Self {
        let face = ttf_parser::Face::parse(bytes, 0).expect("embedded font is valid");
        Self { bytes, face }
    }

    /// The TrueType file, for embedding in a PDF.
    pub fn bytes(&self) -> &'static [u8] {
        self.bytes
    }

    /// Width of `text` at `size` points (sum of advances, no kerning, like pdf-lib).
    pub fn width(&self, text: &str, size: f32) -> f32 {
        let units: u32 = text
            .chars()
            .map(|ch| {
                self.face
                    .glyph_index(ch)
                    .and_then(|glyph| self.face.glyph_hor_advance(glyph))
                    .map_or(0, u32::from)
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
    fn bold_is_wider() {
        let fonts = Fonts::load();
        assert!(fonts.bold.width("Koncert", 12.0) > fonts.regular.width("Koncert", 12.0));
    }
}
