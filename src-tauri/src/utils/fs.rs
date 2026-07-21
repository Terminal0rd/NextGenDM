use std::path::Path;
use std::fs;
use std::io;
use tracing::debug;

/// Ensure the parent directory of a file exists.
pub fn ensure_directory(path: &Path) -> Result<(), io::Error> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            debug!("Creating directory: {:?}", parent);
            fs::create_dir_all(parent)?;
        }
    }
    Ok(())
}

/// Generate a unique filename if the target already exists.
pub fn get_unique_filename(path: &Path) -> std::path::PathBuf {
    let mut new_path = path.to_path_buf();
    let mut counter = 1;
    
    while new_path.exists() {
        let file_stem = path.file_stem().unwrap_or_default().to_string_lossy();
        let extension = path.extension().unwrap_or_default().to_string_lossy();
        
        let new_name = if extension.is_empty() {
            format!("{}_{}", file_stem, counter)
        } else {
            format!("{}_{}.{}", file_stem, counter, extension)
        };
        
        new_path.set_file_name(new_name);
        counter += 1;
    }
    
    new_path
}

/// Get the size of a specific file.
pub fn file_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}
