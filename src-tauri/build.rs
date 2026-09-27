fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "atomic_write",
            "initial_project",
            "save_recovery",
            "load_recovery",
            "build_demo",
            "launch_emulator",
            "open_manual",
            "open_repository",
        ]),
    ))
    .expect("Unable to prepare app permissions");
}
