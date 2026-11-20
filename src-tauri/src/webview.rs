//! La webview no se comporta como un navegador en las versiones de distribución (release): sin recargar (F5, Ctrl+R),
//! imprimir (Ctrl+P), buscar (Ctrl+F) ni atrás/adelante con el teclado. Se hace con la API de WebView2, que conserva los
//! atajos de edición (Ctrl+C/X/V/A/Z) y de movimiento. En desarrollo (debug) siguen disponibles.
//!
//! Menú contextual: fuera de los campos editables lo bloquea `src/lib/context-menu.ts`. En los campos se conserva el
//! de WebView2 (corrector, emoji, deshacer, cortar, copiar, pegar, seleccionar todo…), sin sus comandos de navegador.
//! WebView2 da a cada ítem un nombre (`cut`, `spellcheck`, `selectAll`…) y usa `other` para lo que no tiene nombre
//! propio; en un campo de texto, el único comando así es «Import passwords», del gestor de contraseñas de Edge. Se
//! quitan los comandos `other` (nunca los submenús, como «Writing direction») y los separadores que quedan sobrando.
//! No se desactivan los menús de WebView2 (`AreDefaultContextMenusEnabled`): eso los quitaría también de los campos.
//!
//! El zoom no necesita código: `zoomHotkeysEnabled` vale `false` por defecto y wry lo aplica a `IsZoomControlEnabled`
//! e `IsPinchZoomEnabled`, en debug y en release.

/// Un ítem del menú contextual de WebView2, por lo que importa para filtrarlo.
#[cfg(any(test, all(windows, not(debug_assertions))))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MenuItem {
    Separator,
    /// Un comando sin nombre propio (`other`): una función del navegador, no de edición.
    UnnamedCommand,
    Other,
}

/// Qué ítems quitar, de mayor a menor índice (para quitarlos uno a uno sin mover los que faltan): los comandos sin
/// nombre propio y los separadores que quedan al principio, al final o junto a otro.
#[cfg(any(test, all(windows, not(debug_assertions))))]
fn items_to_remove(items: &[MenuItem]) -> Vec<usize> {
    let mut remove: Vec<usize> = Vec::new();
    // El último ítem que se queda es un separador (o no hay ninguno todavía: cuenta como separador).
    let mut after_separator = true;
    let mut pending_separator = None;
    for (index, item) in items.iter().enumerate() {
        match item {
            MenuItem::UnnamedCommand => remove.push(index),
            MenuItem::Separator if after_separator => remove.push(index),
            MenuItem::Separator => {
                pending_separator = Some(index);
                after_separator = true;
            }
            MenuItem::Other => {
                pending_separator = None;
                after_separator = false;
            }
        }
    }
    // Un separador al final no separa nada.
    remove.extend(pending_separator);
    remove.sort_unstable_by(|a, b| b.cmp(a));
    remove
}

/// Aplica la configuración a la ventana. En debug no hace nada.
pub fn configure_webview(window_handle: &tauri::WebviewWindow) {
    #[cfg(all(windows, not(debug_assertions)))]
    {
        let result = window_handle.with_webview(|webview| {
            if configure(&webview.controller()).is_err() {
                log::error!("No se pudo configurar WebView2");
            }
        });
        if result.is_err() {
            log::error!("No se pudo acceder a WebView2");
        }
    }
    #[cfg(not(all(windows, not(debug_assertions))))]
    let _ = window_handle;
}

#[cfg(all(windows, not(debug_assertions)))]
fn configure(
    controller: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller,
) -> windows::core::Result<()> {
    use webview2_com::ContextMenuRequestedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND, COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND,
        COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR, ICoreWebView2_11, ICoreWebView2Settings3,
    };
    use windows::core::{Interface, PWSTR};

    // SAFETY: llamadas COM sobre el controlador de la propia ventana, desde el hilo de la webview (with_webview); el
    // manejador lo llama WebView2 en ese mismo hilo, con argumentos válidos durante la llamada.
    unsafe {
        let webview = controller.CoreWebView2()?;
        webview
            .Settings()?
            .cast::<ICoreWebView2Settings3>()?
            .SetAreBrowserAcceleratorKeysEnabled(false)?;

        let handler = ContextMenuRequestedEventHandler::create(Box::new(|_, args| {
            let Some(args) = args else { return Ok(()) };
            let menu = args.MenuItems()?;
            let mut count = 0;
            menu.Count(&mut count)?;
            let mut items = Vec::with_capacity(count as usize);
            for index in 0..count {
                let item = menu.GetValueAtIndex(index)?;
                let mut kind = COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND::default();
                item.Kind(&mut kind)?;
                let mut name = PWSTR::null();
                item.Name(&mut name)?;
                let name = webview2_com::take_pwstr(name);
                items.push(if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR {
                    MenuItem::Separator
                } else if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND && name == "other" {
                    MenuItem::UnnamedCommand
                } else {
                    MenuItem::Other
                });
            }
            for index in items_to_remove(&items) {
                menu.RemoveValueAtIndex(index as u32)?;
            }
            Ok(())
        }));
        // El manejador vive lo que la webview (la ventana principal): no hace falta guardar el token para quitarlo.
        let mut token = 0;
        webview
            .cast::<ICoreWebView2_11>()?
            .add_ContextMenuRequested(&handler, &mut token)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::MenuItem::{Other as Item, Separator as Sep, UnnamedCommand as Unnamed};
    use super::items_to_remove;

    #[test]
    fn removes_the_password_import_and_its_extra_separator() {
        // Emoji | Import passwords | Deshacer, Rehacer | …, Seleccionar todo | Dirección de escritura | Más herramientas
        let menu = [
            Item, Sep, Unnamed, Sep, Item, Item, Sep, Item, Item, Sep, Item, Sep, Item,
        ];
        assert_eq!(items_to_remove(&menu), vec![3, 2]);
    }

    #[test]
    fn keeps_a_menu_without_unnamed_commands() {
        let menu = [Item, Sep, Item, Item, Sep, Item];
        assert_eq!(items_to_remove(&menu), Vec::<usize>::new());
    }

    #[test]
    fn drops_separators_left_at_the_edges() {
        assert_eq!(items_to_remove(&[Unnamed, Sep, Item]), vec![1, 0]);
        assert_eq!(items_to_remove(&[Item, Sep, Unnamed]), vec![2, 1]);
        assert_eq!(items_to_remove(&[Unnamed]), vec![0]);
    }

    #[test]
    fn collapses_consecutive_separators() {
        assert_eq!(items_to_remove(&[Item, Sep, Sep, Sep, Item]), vec![3, 2]);
    }
}
