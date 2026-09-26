#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::collections::HashMap;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::Manager;

fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid destination")?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    file.write_all(data).map_err(|e| e.to_string())?;
    file.as_file().sync_all().map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn initial_project() -> Result<Option<(String, Vec<u8>)>, String> {
    if let Some(path) = std::env::args().nth(1) {
        let file = Path::new(&path);
        if file.extension().and_then(|s| s.to_str()) != Some("snesgraph") {
            return Ok(None);
        }
        if fs::metadata(file).map_err(|e| e.to_string())?.len() > 128 * 1024 * 1024 {
            return Err("Project exceeds 128 MiB".to_owned());
        }
        return Ok(Some((
            path.clone(),
            fs::read(file).map_err(|e| e.to_string())?,
        )));
    }
    Ok(None)
}
#[tauri::command]
fn atomic_write(path: String, data: Vec<u8>) -> Result<(), String> {
    write_atomic(Path::new(&path), &data)
}
fn recovery(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("recovery.snesgraph"))
}
#[tauri::command]
fn save_recovery(app: tauri::AppHandle, data: Vec<u8>) -> Result<(), String> {
    write_atomic(&recovery(&app)?, &data)
}
#[tauri::command]
fn load_recovery(app: tauri::AppHandle) -> Result<Option<Vec<u8>>, String> {
    let p = recovery(&app)?;
    if p.exists() {
        Ok(Some(fs::read(p).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}
#[tauri::command]
async fn build_demo(
    files: HashMap<String, Vec<u8>>,
    ca65: String,
    ld65: String,
) -> Result<Vec<u8>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
        for (name, data) in files {
            if name.contains('/') || name.contains('\\') || name.starts_with('.') {
                return Err("Invalid demo filename".to_owned());
            }
            fs::write(dir.path().join(name), data).map_err(|e| e.to_string())?;
        }
        for (exe, args) in [
            (ca65, vec!["main.s", "-o", "main.o"]),
            (ld65, vec!["-C", "lorom.cfg", "main.o", "-o", "demo.sfc"]),
        ] {
            let output = Command::new(&exe)
                .args(args)
                .current_dir(dir.path())
                .output()
                .map_err(|e| format!("{}: {}", exe, e))?;
            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
        }
        fs::read(dir.path().join("demo.sfc")).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn launch_emulator(executable: String, rom: Vec<u8>, app: tauri::AppHandle) -> Result<(), String> {
    let directory = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join("preview.sfc");
    write_atomic(&path, &rom)?;
    Command::new(executable)
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(target_os = "linux")]
fn linux_webkit_setup() -> std::io::Result<Option<tempfile::NamedTempFile>> {
    // Set these before GTK/WebKit starts any threads. Explicit user settings win.
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    if std::env::var_os("FONTCONFIG_FILE").is_some() {
        return Ok(None);
    }
    let config = include_str!("../linux/fonts.conf");
    // Only restrict fonts when at least one of the configured directories exists.
    let has_fonts = config
        .lines()
        .filter_map(|line| line.trim().strip_prefix("<dir>")?.strip_suffix("</dir>"))
        .any(|directory| Path::new(directory).is_dir());
    if !has_fonts {
        return Ok(None);
    }
    let mut file = tempfile::NamedTempFile::new()?;
    file.write_all(config.as_bytes())?;
    std::env::set_var("FONTCONFIG_FILE", file.path());
    Ok(Some(file))
}

fn main() {
    // Keep the configuration available for WebKit subprocesses until shutdown.
    #[cfg(target_os = "linux")]
    let _font_config = linux_webkit_setup().unwrap_or_else(|error| {
        eprintln!("Unable to prepare WebKit font configuration: {error}");
        None
    });
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            atomic_write,
            initial_project,
            save_recovery,
            load_recovery,
            build_demo,
            launch_emulator
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start SNES Graph");
}
