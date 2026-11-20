//! Punto de entrada de la app: plugins, ventana principal y logs.

mod lifecycle;
mod webview;
mod window_bounds;
mod window_controls;

use std::time::Duration;

use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};
use tauri_plugin_window_state::StateFlags;

/// La ventana se crea oculta (`visible: false`) y la muestra la interfaz cuando ya ha pintado con su tema, sin destello.
/// Si la interfaz no llega a hacerlo (no carga), se muestra igualmente pasado este tiempo.
const SHOW_FALLBACK: Duration = Duration::from_secs(4);

/// Qué entra en el log: todo lo de la app (Rust y la interfaz) y, de Tauri, sus plugins y demás dependencias, solo los
/// avisos y errores. Así un fallo interno (por ejemplo, no poder guardar el tamaño de la ventana) queda registrado sin
/// llenar el archivo con su información de rutina.
fn keep_log(target: &str, level: log::Level) -> bool {
    let own = target.starts_with(env!("CARGO_CRATE_NAME"))
        || target.starts_with(tauri_plugin_log::WEBVIEW_TARGET);
    own || level <= log::Level::Warn
}

/// El mensaje de un pánico: dónde ocurrió (archivo y línea del código), sin su texto, que podría llevar datos.
fn panic_message(location: Option<&std::panic::Location<'_>>) -> String {
    match location {
        Some(location) => format!("Pánico en {}:{}", location.file(), location.line()),
        None => "Pánico en un lugar desconocido".to_owned(),
    }
}

/// Logs en archivo (carpeta de logs de la app), 5 archivos de 1 MB como mucho, en hora local; en desarrollo también
/// por consola.
fn log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let mut targets = vec![Target::new(TargetKind::LogDir { file_name: None })];
    if cfg!(debug_assertions) {
        targets.push(Target::new(TargetKind::Stdout));
    }
    tauri_plugin_log::Builder::new()
        .filter(|entry| keep_log(entry.target(), entry.level()))
        .clear_targets()
        .targets(targets)
        .max_file_size(1_000_000)
        .rotation_strategy(RotationStrategy::KeepSome(5))
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .build()
}

pub fn run() {
    // Una sola instancia, registrada la primera: el segundo proceso sale antes de inicializar nada más.
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, _args, _directory| lifecycle::show_window(app),
        ))
        .plugin(log_plugin())
        // Tamaño, posición y maximizado guardados. Ni las decoraciones (las decide la configuración) ni la
        // visibilidad: la ventana la muestra la interfaz al pintar (SHOW_FALLBACK).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::all() & !(StateFlags::DECORATIONS | StateFlags::VISIBLE),
                )
                .build(),
        )
        // Actualizaciones firmadas: el plugin verifica la firma con la clave pública de tauri.conf.json. Al instalar en
        // Windows, el plugin cierra la app y el instalador (modo pasivo, con `/R`) la vuelve a abrir.
        .plugin(tauri_plugin_updater::Builder::new().build());

    let result = builder
        // Keep running: el estado (desactivado hasta que el frontend aplica la preferencia), su comando y el cierre.
        .manage(lifecycle::KeepRunning::default())
        .invoke_handler(tauri::generate_handler![
            lifecycle::set_keep_running,
            window_controls::set_maximize_button_area
        ])
        .on_window_event(lifecycle::on_window_event)
        .setup(|app| {
            // En release no hay consola: un pánico se registra en el log antes de terminar (panic = "abort"). En
            // desarrollo también se conserva el aviso por defecto, con su mensaje, en la consola.
            #[cfg(debug_assertions)]
            let default_hook = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |info| {
                log::error!("{}", panic_message(info.location()));
                #[cfg(debug_assertions)]
                default_hook(info);
            }));
            if let Some(window_handle) = app.get_webview_window(lifecycle::MAIN_WINDOW) {
                // Snap Layouts sobre el botón de maximizar que dibuja la interfaz (window_controls.rs).
                #[cfg(windows)]
                window_controls::install(&window_handle);
                webview::configure_webview(&window_handle);
                // window-state ya ha restaurado el tamaño guardado: si no cabe en la pantalla, se ajusta.
                window_bounds::fit_to_screen(&window_handle);
            }
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(SHOW_FALLBACK);
                lifecycle::show_if_still_hidden(&app_handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!());

    // Un fallo al arrancar (por ejemplo, sin WebView2): el error de Tauri describe qué falló, no datos del usuario.
    if let Err(error) = result {
        log::error!("La app terminó con un error: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use log::Level;

    #[test]
    fn keeps_everything_from_the_app_and_the_interface() {
        for level in [Level::Error, Level::Warn, Level::Info, Level::Debug] {
            assert!(keep_log(
                concat!(env!("CARGO_CRATE_NAME"), "::lifecycle"),
                level
            ));
            assert!(keep_log(tauri_plugin_log::WEBVIEW_TARGET, level));
        }
    }

    #[test]
    fn keeps_only_warnings_and_errors_from_dependencies() {
        assert!(keep_log("tauri_plugin_window_state", Level::Error));
        assert!(keep_log("tauri::app", Level::Warn));
        assert!(!keep_log("tauri::app", Level::Info));
        assert!(!keep_log("tao::platform_impl", Level::Debug));
    }

    #[test]
    fn panic_message_has_the_location_only() {
        let location = std::panic::Location::caller();
        assert_eq!(
            panic_message(Some(location)),
            format!("Pánico en {}:{}", location.file(), location.line())
        );
        assert_eq!(panic_message(None), "Pánico en un lugar desconocido");
    }
}
