use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use url::Url;
use tracing::info;
use tauri::command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GrabbedMedia {
    pub url: String,
    pub tag: String,
    pub filename: Option<String>,
}

#[command]
pub async fn grab_site(target_url: String) -> Result<Vec<GrabbedMedia>, String> {
    info!("Grabbing site: {}", target_url);

    let client = reqwest::Client::new();
    let res = client.get(&target_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let html = res.text().await.map_err(|e| e.to_string())?;
    let document = Html::parse_document(&html);
    let base_url = Url::parse(&target_url).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    // Selectors
    let img_sel = Selector::parse("img[src]").unwrap();
    let vid_sel = Selector::parse("video[src], source[src]").unwrap();
    let audio_sel = Selector::parse("audio[src]").unwrap();
    let a_sel = Selector::parse("a[href]").unwrap();

    let mut process_url = |raw_url: &str, tag: &str| {
        if let Ok(parsed_url) = base_url.join(raw_url) {
            let parsed_str = parsed_url.to_string();
            if parsed_str.starts_with("http") && !results.iter().any(|r: &GrabbedMedia| r.url == parsed_str) {
                let filename = parsed_url.path_segments().and_then(|segs| segs.last()).map(|s| s.to_string());
                results.push(GrabbedMedia {
                    url: parsed_str,
                    tag: tag.to_string(),
                    filename,
                });
            }
        }
    };

    for element in document.select(&img_sel) {
        if let Some(src) = element.value().attr("src") {
            process_url(src, "img");
        }
    }

    for element in document.select(&vid_sel) {
        if let Some(src) = element.value().attr("src") {
            process_url(src, "video");
        }
    }

    for element in document.select(&audio_sel) {
        if let Some(src) = element.value().attr("src") {
            process_url(src, "audio");
        }
    }

    // Known media extensions for hrefs
    let media_exts = ["mp4", "mkv", "avi", "mp3", "flac", "zip", "rar", "7z", "pdf", "iso", "exe"];
    for element in document.select(&a_sel) {
        if let Some(href) = element.value().attr("href") {
            if let Ok(parsed) = base_url.join(href) {
                if let Some(path) = parsed.path_segments().and_then(|s| s.last()) {
                    let ext = path.split('.').last().unwrap_or("").to_lowercase();
                    if media_exts.contains(&ext.as_str()) {
                        process_url(href, "link");
                    }
                }
            }
        }
    }

    Ok(results)
}
