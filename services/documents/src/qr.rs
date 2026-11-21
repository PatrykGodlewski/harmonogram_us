//! QR codes as PNG images (same settings as the web card: level M, 1-module margin).

use image::{ImageFormat, Luma};
use qrcode::{EcLevel, QrCode};
use std::io::Cursor;

/// A PNG of `text` as a QR code, at least 600 px wide.
pub fn png(text: &str) -> Vec<u8> {
    let code = QrCode::with_error_correction_level(text, EcLevel::M)
        .expect("the QR payload fits in a QR code");
    let image = code
        .render::<Luma<u8>>()
        .quiet_zone(false)
        .min_dimensions(600, 600)
        .build();
    // One module of white margin, as the qrcode npm package draws with `margin: 1`.
    let module = image.width() / code.width() as u32;
    let size = image.width() + 2 * module;
    let mut framed = image::GrayImage::from_pixel(size, size, Luma([255]));
    image::imageops::overlay(&mut framed, &image, module.into(), module.into());
    let mut out = Cursor::new(Vec::new());
    framed
        .write_to(&mut out, ImageFormat::Png)
        .expect("encoding a PNG in memory cannot fail");
    out.into_inner()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_back() {
        let text = format!("harmonogram-ticket:{}", "c".repeat(64));
        let image = image::load_from_memory(&png(&text)).unwrap().to_luma8();
        assert!(image.width() >= 600);
        let mut prepared = rqrr::PreparedImage::prepare(image);
        let grids = prepared.detect_grids();
        assert_eq!(grids.len(), 1);
        let (_, content) = grids[0].decode().unwrap();
        assert_eq!(content, text);
    }
}
