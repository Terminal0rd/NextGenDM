//! URL validation, filename extraction, and sanitisation utilities.

use crate::engine::error::EngineError;

/// Parse and validate a URL.
///
/// Rejects schemes other than `http`, `https`, and `ftp`.
/// Explicitly blocks `file:`, `javascript:`, and `data:` URLs.
pub fn validate_url(input: &str) -> Result<url::Url, EngineError> {
    let parsed = url::Url::parse(input)?;

    match parsed.scheme() {
        "http" | "https" | "ftp" => Ok(parsed),
        scheme => Err(EngineError::InvalidUrl(format!(
            "Unsupported URL scheme: {scheme}"
        ))),
    }
}

/// Extract a filename from the last non-empty path segment of a URL.
///
/// Percent-encoding is decoded. Falls back to `"download"` if no
/// meaningful segment is found.
pub fn extract_filename_from_url(url: &url::Url) -> String {
    let raw = url
        .path_segments()
        .and_then(|segs| {
            segs.rev()
                .find(|s| !s.is_empty())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "download".to_string());

    // Decode percent-encoding.
    let decoded = percent_decode(&raw);
    let name = decoded.trim().to_string();

    if name.is_empty() {
        "download".to_string()
    } else {
        sanitize_filename(&name)
    }
}

/// Parse a `Content-Disposition` header value and extract the filename.
///
/// Supports both `filename="..."` and RFC 5987 `filename*=UTF-8''...`
/// parameters.
pub fn extract_filename_from_content_disposition(header: &str) -> Option<String> {
    // Try filename* first (RFC 5987 extended parameter).
    if let Some(filename) = parse_filename_star(header) {
        let sanitised = sanitize_filename(&filename);
        if !sanitised.is_empty() {
            return Some(sanitised);
        }
    }

    // Fall back to filename="..." or filename=...
    if let Some(filename) = parse_filename_basic(header) {
        let sanitised = sanitize_filename(&filename);
        if !sanitised.is_empty() {
            return Some(sanitised);
        }
    }

    None
}

/// Sanitise a filename by removing path-traversal components and
/// characters that are illegal on Windows/Linux.
///
/// - Strips directory separators (`\`, `/`)
/// - Removes characters: `:`, `*`, `?`, `"`, `<`, `>`, `|`
/// - Strips leading/trailing dots and spaces
/// - Removes `..` components
/// - Truncates to 255 characters
pub fn sanitize_filename(name: &str) -> String {
    let mut result = String::with_capacity(name.len());

    for ch in name.chars() {
        match ch {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => {
                result.push('_');
            }
            c if c.is_control() => {}
            c => result.push(c),
        }
    }

    // Remove path-traversal sequences.
    let result = result.replace("..", "");

    // Trim leading/trailing dots and whitespace.
    let result = result.trim_matches(|c: char| c == '.' || c.is_whitespace());

    // Truncate to 255 characters.
    let result: String = result.chars().take(255).collect();

    if result.is_empty() {
        "download".to_string()
    } else {
        result
    }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/// Decode percent-encoded strings manually (no extra dependency).
fn percent_decode(input: &str) -> String {
    let mut result = Vec::with_capacity(input.len());
    let bytes = input.as_bytes();
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (
                hex_value(bytes[i + 1]),
                hex_value(bytes[i + 2]),
            ) {
                result.push(hi << 4 | lo);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }

    String::from_utf8_lossy(&result).to_string()
}

fn hex_value(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Parse `filename*=UTF-8''encoded_name` from Content-Disposition.
fn parse_filename_star(header: &str) -> Option<String> {
    let lower = header.to_lowercase();
    let idx = lower.find("filename*=")?;
    let rest = &header[idx + "filename*=".len()..];

    // Expected format: charset'language'value (e.g., UTF-8''my%20file.txt)
    let value = rest.split(';').next()?.trim();

    // Find the second apostrophe.
    let mut apostrophe_count = 0;
    let mut start = 0;
    for (i, ch) in value.char_indices() {
        if ch == '\'' {
            apostrophe_count += 1;
            if apostrophe_count == 2 {
                start = i + 1;
                break;
            }
        }
    }

    if apostrophe_count < 2 {
        return None;
    }

    let encoded = &value[start..];
    Some(percent_decode(encoded))
}

/// Parse `filename="value"` or `filename=value` from Content-Disposition.
fn parse_filename_basic(header: &str) -> Option<String> {
    let lower = header.to_lowercase();

    // Find "filename=" but NOT "filename*="
    let mut search_from = 0;
    loop {
        let idx = lower[search_from..].find("filename=")?;
        let abs_idx = search_from + idx;

        // Make sure it's not filename*=
        if abs_idx > 0 && header.as_bytes()[abs_idx - 1] == b'*' {
            search_from = abs_idx + "filename=".len();
            continue;
        }

        let rest = &header[abs_idx + "filename=".len()..];
        let rest = rest.trim_start();

        // Quoted string
        if rest.starts_with('"') {
            let inner = &rest[1..];
            if let Some(end) = inner.find('"') {
                return Some(inner[..end].to_string());
            }
        }

        // Unquoted token
        let end = rest
            .find(|c: char| c == ';' || c.is_whitespace())
            .unwrap_or(rest.len());
        let val = rest[..end].trim().to_string();
        if !val.is_empty() {
            return Some(val);
        }

        search_from = abs_idx + "filename=".len();
    }
}
