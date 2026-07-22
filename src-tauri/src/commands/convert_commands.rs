use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tracing::{error, info};

#[tauri::command]
pub async fn convert_media(
    app: AppHandle,
    input_path: String,
    target_ext: String,
    output_dir: Option<String>,
) -> Result<String, String> {
    let input = Path::new(&input_path);
    if !input.exists() {
        return Err("Input file does not exist".into());
    }

    let file_name = input.file_stem().unwrap_or_default();
    
    let output = if let Some(dir) = output_dir {
        Path::new(&dir).join(file_name).with_extension(&target_ext)
    } else {
        input.with_extension(&target_ext)
    };

    
    // Determine if it's a document conversion based on BOTH input and target extension
    let input_ext = input
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let doc_exts = ["pdf", "docx", "doc", "html", "htm", "txt", "rtf", "epub", "md", "odt"];
    let target_lower = target_ext.to_lowercase();
    let is_doc = doc_exts.contains(&input_ext.as_str()) || doc_exts.contains(&target_lower.as_str());

    info!(%input_path, target_ext, is_doc, "Starting offline file conversion");

    if is_doc {
        // Use Pandoc sidecar for document conversion
        let out = app
            .shell()
            .sidecar("pandoc")
            .map_err(|e| format!("Failed to spawn pandoc: {}. Is the binary in the bin/ directory?", e))?
            .args([
                &input.to_string_lossy(),
                "-o",
                &output.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|e| format!("Pandoc execution failed: {}", e))?;

        if !out.status.success() {
            let err_str = String::from_utf8_lossy(&out.stderr);
            error!("Pandoc conversion failed: {}", err_str);
            return Err(format!("Document conversion failed: {}", err_str));
        }
    } else {
        // Use FFmpeg sidecar for media conversion
        let out = app
            .shell()
            .sidecar("ffmpeg")
            .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?
            .args([
                "-y", // overwrite
                "-i",
                &input.to_string_lossy(),
                &output.to_string_lossy(),
            ])
            .output()
            .await
            .map_err(|e| format!("FFmpeg execution failed: {}", e))?;

        if !out.status.success() {
            let err_str = String::from_utf8_lossy(&out.stderr);
            error!("FFmpeg conversion failed: {}", err_str);
            return Err(format!("Media conversion failed: {}", err_str));
        }
    }

    info!("Conversion successful: {:?}", output);
    Ok(output.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let parent = std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(""));
        let _ = opener::open(parent);
    }
    Ok(())
}
