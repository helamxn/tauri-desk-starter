//! «Keep the app running when closed»: cerrar la ventana principal la oculta y deja la app en la bandeja del sistema. El
//! icono de la bandeja solo existe con la opción activada, y su menú es la forma de volver o de salir del todo.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Manager, Runtime, State, Window, WindowEvent,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main";
const SHOW_MENU: &str = "show";
const QUIT_MENU: &str = "quit";

/// La opción, desactivada hasta que el frontend aplica la preferencia guardada al arrancar.
#[derive(Default)]
pub struct KeepRunning(AtomicBool);

impl KeepRunning {
    fn active(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// Los textos del menú de la bandeja, con el nombre de la app (productName), no escritos a mano.
fn menu_labels(name: &str) -> (String, String) {
    (format!("Show {name}"), format!("Quit {name}"))
}

/// Si cerrar esta ventana debe ocultarla en vez de cerrarla.
fn should_hide(label: &str, keep_running: bool) -> bool {
    keep_running && label == MAIN_WINDOW
}

/// Muestra, restaura y enfoca la ventana principal (bandeja, segundo arranque).
pub fn show_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window_handle) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    for (action, result) in [
        ("mostrar", window_handle.show()),
        ("restaurar", window_handle.unminimize()),
        ("enfocar", window_handle.set_focus()),
    ] {
        if result.is_err() {
            log::warn!("No se pudo {action} la ventana");
        }
    }
}

/// Red de seguridad del arranque: la ventana nace oculta y la muestra la interfaz al pintar. Si sigue oculta, es que la
/// interfaz no llegó a cargar, y se muestra igualmente. Con Keep running activo no se toca: la activa la interfaz (así
/// que cargó), y una ventana oculta es entonces una ventana que el usuario mandó a la bandeja.
pub fn show_if_still_hidden<R: Runtime>(app: &AppHandle<R>) {
    if app.state::<KeepRunning>().active() {
        return;
    }
    let Some(window_handle) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if window_handle.is_visible().is_ok_and(|visible| !visible) {
        log::warn!("La interfaz no mostró la ventana al arrancar: se muestra igualmente");
        show_window(app);
    }
}

fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }
    let name = app.package_info().name.clone();
    let (show, quit) = menu_labels(&name);
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, SHOW_MENU, show, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT_MENU, quit, true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(&name)
        .menu(&menu)
        // Clic izquierdo: mostrar la ventana; el menú, con el derecho.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            SHOW_MENU => show_window(app),
            QUIT_MENU => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Activa o desactiva Keep running. Activar crea primero la bandeja: si no se puede, devuelve error y la opción sigue
/// desactivada (sin bandeja, cerrar ocultaría la ventana sin forma de volver ni de salir). Desactivar quita la bandeja.
#[tauri::command]
pub fn set_keep_running<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, KeepRunning>,
    enabled: bool,
) -> Result<(), String> {
    if enabled {
        create_tray(&app).map_err(|_| {
            log::error!("No se pudo crear la bandeja");
            "Couldn't add the app to the system tray.".to_string()
        })?;
        state.0.store(true, Ordering::SeqCst);
    } else {
        state.0.store(false, Ordering::SeqCst);
        app.remove_tray_by_id(TRAY_ID);
    }
    Ok(())
}

/// Con la opción activada, cerrar la ventana principal (la X, Alt+F4) la oculta en vez de cerrarla.
pub fn on_window_event<R: Runtime>(window_handle: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event
        && should_hide(
            window_handle.label(),
            window_handle.state::<KeepRunning>().active(),
        )
    {
        api.prevent_close();
        if window_handle.hide().is_err() {
            log::warn!("No se pudo ocultar la ventana");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hides_only_main_when_enabled() {
        assert!(should_hide("main", true));
        assert!(!should_hide("main", false));
        assert!(!should_hide("otra", true));
    }
}
