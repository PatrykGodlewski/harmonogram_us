//! Fitting text into a box: a port of `packages/api/src/pdf/layout.ts`.

/// The font size chosen and the lines to draw at it.
#[derive(Debug, Clone, PartialEq)]
pub struct Fitted {
    pub size: f32,
    pub lines: Vec<String>,
}

/// Splits text into lines no wider than `max_width`; words that are too long are broken.
fn wrap(text: &str, measure: &impl Fn(&str, f32) -> f32, size: f32, max_width: f32) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        let candidate = if line.is_empty() {
            word.to_string()
        } else {
            format!("{line} {word}")
        };
        if measure(&candidate, size) <= max_width {
            line = candidate;
            continue;
        }
        if !line.is_empty() {
            lines.push(std::mem::take(&mut line));
        }
        // A word wider than the line goes letter by letter.
        let mut part = String::new();
        for ch in word.chars() {
            let mut next = part.clone();
            next.push(ch);
            if !part.is_empty() && measure(&next, size) > max_width {
                lines.push(std::mem::take(&mut part));
                part.push(ch);
            } else {
                part = next;
            }
        }
        line = part;
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

/// The largest of `sizes` (largest first) at which `text` fits in `max_lines` lines;
/// if none fits, the smallest size with the last line cut short with "…".
pub fn fit_lines(
    text: &str,
    measure: impl Fn(&str, f32) -> f32,
    max_width: f32,
    sizes: &[f32],
    max_lines: usize,
) -> Fitted {
    for &size in sizes {
        let lines = wrap(text, &measure, size, max_width);
        if lines.len() <= max_lines {
            return Fitted { size, lines };
        }
    }
    let size = sizes.last().copied().unwrap_or(12.0);
    let mut lines = wrap(text, &measure, size, max_width);
    lines.truncate(max_lines);
    let mut last = lines.pop().unwrap_or_default();
    while !last.is_empty() && measure(&format!("{last}…"), size) > max_width {
        last.pop();
    }
    lines.push(format!("{}…", last.trim_end()));
    Fitted { size, lines }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    /// Every character is half the font size wide.
    fn mono(text: &str, size: f32) -> f32 {
        text.chars().count() as f32 * size * 0.5
    }

    #[test]
    fn keeps_largest_size_that_fits() {
        let fitted = fit_lines("Koncert jesienny", mono, 200.0, &[16.0, 14.0], 1);
        assert_eq!(fitted.size, 16.0);
        assert_eq!(fitted.lines, vec!["Koncert jesienny"]);
    }

    #[test]
    fn wraps_to_max_lines() {
        // 16 chars at 10 pt = 80 pt; the box is 50 pt wide.
        let fitted = fit_lines("Koncert jesienny", mono, 50.0, &[10.0], 2);
        assert_eq!(fitted.lines, vec!["Koncert", "jesienny"]);
    }

    #[test]
    fn shrinks_before_wrapping_too_much() {
        let fitted = fit_lines("Koncert jesienny", mono, 50.0, &[16.0, 10.0], 2);
        assert_eq!(fitted.size, 10.0);
    }

    #[test]
    fn breaks_overlong_word() {
        let fitted = fit_lines("abcdefghij", mono, 20.0, &[10.0], 3);
        assert_eq!(fitted.lines, vec!["abcd", "efgh", "ij"]);
    }

    #[test]
    fn ellipsis_when_nothing_fits() {
        let fitted = fit_lines("jeden dwa trzy cztery pięć", mono, 30.0, &[10.0], 2);
        assert_eq!(fitted.lines.len(), 2);
        let last = fitted.lines.last().unwrap();
        assert!(last.ends_with('…'), "{last}");
        assert!(mono(last, 10.0) <= 30.0);
    }

    #[test]
    fn empty_text_has_no_lines() {
        assert!(fit_lines("  ", mono, 30.0, &[10.0], 1).lines.is_empty());
    }

    proptest! {
        #[test]
        fn never_wider_than_box(text in "[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ .·-]{0,400}") {
            let fitted = fit_lines(&text, mono, 120.0, &[16.0, 14.0, 12.0], 2);
            prop_assert!(fitted.lines.len() <= 2);
            for line in &fitted.lines {
                prop_assert!(mono(line, fitted.size) <= 120.0, "{line}");
            }
        }
    }
}
