// Los comandos propios se declaran aquí y quedan denegados salvo que una capability los conceda.
const COMMANDS: &[&str] = &["set_keep_running", "set_maximize_button_area"];

fn main() {
    // La versión de la app está en package.json (tauri.conf.json la lee de ahí). tauri-build no vigila ese archivo:
    // sin esto, cambiar la versión no recompilaría y el ejecutable conservaría la anterior.
    println!("cargo:rerun-if-changed=../package.json");
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build")
}
