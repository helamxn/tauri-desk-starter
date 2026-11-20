//! Snap Layouts en la ventana sin marco.
//!
//! Windows 11 muestra su menú de distribuciones al pasar el ratón por el botón de maximizar solo si la ventana responde
//! `HTMAXBUTTON` a `WM_NCHITTEST` en ese punto. En una ventana sin marco el botón lo dibuja la interfaz
//! (`src/lib/window-controls.ts`) y el ratón lo recibe WebView2, que cubre todo el área de cliente, así que nadie da
//! esa respuesta. Se coloca encima del botón una ventana nativa hija, invisible, que la da:
//!
//! - La interfaz mide su botón y envía su zona con [`set_maximize_button_area`], en píxeles CSS y desde la esquina
//!   superior derecha. Aquí se pasa a píxeles físicos con la escala de la ventana, y se recoloca cuando la ventana
//!   cambia de tamaño o de monitor (el botón va pegado a la derecha, así que su distancia al borde no cambia).
//! - La ventana nativa se queda con el ratón: avisa a la interfaz de entrar, salir, pulsar y soltar (para pintar el
//!   hover y la pulsación) con el evento [`MAXIMIZE_EVENT`], y al hacer clic maximiza o restaura como el botón nativo,
//!   con `WM_SYSCOMMAND`.
//!
//! Tauri no lo resuelve por sí mismo (tauri-apps/tauri#4531, rust-windowing/winit#3884).

/// El evento que recibe la interfaz, con lo que hace el ratón sobre el botón de maximizar.
pub const MAXIMIZE_EVENT: &str = "window-controls://maximize";

/// Distancia al borde y tamaño más grandes que se aceptan, en píxeles CSS: ningún botón de barra de título mide más.
const MAX_OFFSET: f64 = 16_384.0;
const MAX_SIZE: f64 = 512.0;

/// Lo que hace el ratón sobre el botón de maximizar, para que la interfaz lo pinte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MaximizeButtonEvent {
    Enter,
    Leave,
    Press,
    Release,
}

impl MaximizeButtonEvent {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Enter => "enter",
            Self::Leave => "leave",
            Self::Press => "press",
            Self::Release => "release",
        }
    }
}

/// La zona del botón de maximizar en píxeles CSS: distancia al borde superior y al derecho del área de cliente, ancho
/// y alto. Un ancho o un alto de 0 quita la zona (la interfaz ya no tiene el botón).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ButtonArea {
    top: f64,
    right: f64,
    width: f64,
    height: f64,
}

/// Un rectángulo en píxeles físicos, dentro del área de cliente.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysicalRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl ButtonArea {
    /// Valida lo que llega de la interfaz: números finitos, no negativos y de un tamaño razonable.
    pub fn new(top: f64, right: f64, width: f64, height: f64) -> Option<Self> {
        let within = |value: f64, max: f64| value.is_finite() && (0.0..=max).contains(&value);
        (within(top, MAX_OFFSET)
            && within(right, MAX_OFFSET)
            && within(width, MAX_SIZE)
            && within(height, MAX_SIZE))
        .then_some(Self {
            top,
            right,
            width,
            height,
        })
    }

    /// La zona en un área de cliente de `client_width` píxeles físicos con esa escala, o `None` si está vacía.
    pub fn to_physical(self, client_width: i32, scale: f64) -> Option<PhysicalRect> {
        let physical = |value: f64| (value * scale).round() as i32;
        let (width, height) = (physical(self.width), physical(self.height));
        if width <= 0 || height <= 0 {
            return None;
        }
        Some(PhysicalRect {
            x: client_width - physical(self.right) - width,
            y: physical(self.top),
            width,
            height,
        })
    }
}

/// Coloca la ventana nativa sobre el botón de maximizar de la interfaz. Los valores llegan sin validar: si no son una
/// zona válida, se rechazan sin tocar nada.
#[tauri::command]
pub fn set_maximize_button_area<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    top: f64,
    right: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let area = ButtonArea::new(top, right, width, height).ok_or("Invalid area.")?;
    #[cfg(windows)]
    window
        .run_on_main_thread(move || native::set_area(area))
        .map_err(|_| "Couldn't place the maximize button.".to_string())?;
    #[cfg(not(windows))]
    let _ = (window, area);
    Ok(())
}

/// Crea la ventana nativa (todavía sin zona) en la ventana principal y envía a su webview lo que hace el ratón.
#[cfg(windows)]
pub fn install<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    use tauri::Emitter;

    let Ok(hwnd) = window.hwnd() else {
        log::warn!("No se pudo obtener la ventana nativa para Snap Layouts");
        return;
    };
    let target = window.clone();
    let notify = std::sync::Arc::new(move |event: MaximizeButtonEvent| {
        if target.emit(MAXIMIZE_EVENT, event.as_str()).is_err() {
            log::warn!("No se pudo avisar a la interfaz del botón de maximizar");
        }
    });
    if native::install(hwnd, notify).is_err() {
        log::warn!("No se pudo instalar Snap Layouts en el botón de maximizar");
    }
}

#[cfg(windows)]
mod native {
    use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::Graphics::Gdi::{GetStockObject, HBRUSH, NULL_BRUSH};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT, TrackMouseEvent,
    };
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, GetClientRect, HTMAXBUTTON, HWND_TOP, IDC_ARROW, IsZoomed,
        LoadCursorW, PostMessageW, RegisterClassExW, SC_MAXIMIZE, SC_RESTORE, SWP_HIDEWINDOW,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, SetWindowPos,
        WINDOW_EX_STYLE, WM_DPICHANGED, WM_NCDESTROY, WM_NCHITTEST, WM_NCLBUTTONDOWN,
        WM_NCLBUTTONUP, WM_NCMOUSELEAVE, WM_NCMOUSEMOVE, WM_SIZE, WM_SYSCOMMAND, WNDCLASSEXW,
        WS_CHILD, WS_CLIPSIBLINGS,
    };
    use windows::core::{PCWSTR, w};

    use super::{ButtonArea, MaximizeButtonEvent};

    type Notify = Arc<dyn Fn(MaximizeButtonEvent) + Send + Sync>;

    /// La ventana nativa y su estado. Las ventanas se guardan como enteros (`HWND` no es `Send`); solo se usan desde
    /// el hilo de la interfaz, donde viven.
    struct Overlay {
        parent: isize,
        hwnd: isize,
        area: Option<ButtonArea>,
        hovering: bool,
        pressing: bool,
        notify: Notify,
    }

    /// Hay una sola ventana principal, así que una sola ventana nativa.
    static OVERLAY: Mutex<Option<Overlay>> = Mutex::new(None);

    const CLASS_NAME: PCWSTR = w!("AppMaximizeButtonOverlay");
    /// Identificador del subclass de la ventana principal (para recolocar al cambiar de tamaño).
    const SUBCLASS_ID: usize = 1;

    fn overlay() -> MutexGuard<'static, Option<Overlay>> {
        OVERLAY.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn hwnd(value: isize) -> HWND {
        HWND(value as *mut core::ffi::c_void)
    }

    pub fn install(parent: HWND, notify: Notify) -> windows::core::Result<()> {
        // SAFETY: llamadas Win32 en el hilo de la interfaz, durante `setup`, con la ventana principal viva. La clase y la
        // ventana se crean una vez; el procedimiento cumple la firma de WNDPROC.
        unsafe {
            let instance = HINSTANCE(GetModuleHandleW(PCWSTR::null())?.0);
            let class = WNDCLASSEXW {
                cbSize: size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(overlay_proc),
                hInstance: instance,
                hCursor: LoadCursorW(None, IDC_ARROW)?,
                // Sin fondo: la ventana no pinta nada y deja ver el botón de la interfaz.
                hbrBackground: HBRUSH(GetStockObject(NULL_BRUSH).0),
                lpszClassName: CLASS_NAME,
                ..Default::default()
            };
            if RegisterClassExW(&class) == 0 {
                return Err(windows::core::Error::from_thread());
            }
            let window = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                CLASS_NAME,
                PCWSTR::null(),
                WS_CHILD | WS_CLIPSIBLINGS,
                0,
                0,
                0,
                0,
                Some(parent),
                None,
                Some(instance),
                None,
            )?;
            *overlay() = Some(Overlay {
                parent: parent.0 as isize,
                hwnd: window.0 as isize,
                area: None,
                hovering: false,
                pressing: false,
                notify,
            });
            if !SetWindowSubclass(parent, Some(parent_proc), SUBCLASS_ID, 0).as_bool() {
                return Err(windows::core::Error::from_thread());
            }
        }
        Ok(())
    }

    pub fn set_area(area: ButtonArea) {
        if let Some(state) = overlay().as_mut() {
            state.area = Some(area);
        }
        place();
    }

    /// Coloca la ventana nativa sobre la zona actual, o la oculta si no hay zona. El estado se suelta antes de llamar a
    /// Windows: `SetWindowPos` envía mensajes a la ventana nativa en esta misma llamada.
    fn place() {
        let Some((parent, window, area)) = overlay()
            .as_ref()
            .map(|state| (hwnd(state.parent), hwnd(state.hwnd), state.area))
        else {
            return;
        };
        // SAFETY: las dos ventanas siguen vivas (el estado se borra en WM_NCDESTROY de la principal) y se usan desde su
        // hilo.
        unsafe {
            let mut client = RECT::default();
            let rect = area
                .filter(|_| GetClientRect(parent, &mut client).is_ok())
                .and_then(|area| {
                    let dpi = GetDpiForWindow(parent);
                    let scale = if dpi == 0 { 1.0 } else { f64::from(dpi) / 96.0 };
                    area.to_physical(client.right - client.left, scale)
                });
            let placed = match rect {
                Some(rect) => SetWindowPos(
                    window,
                    Some(HWND_TOP),
                    rect.x,
                    rect.y,
                    rect.width,
                    rect.height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                ),
                None => SetWindowPos(
                    window,
                    None,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_HIDEWINDOW,
                ),
            };
            if placed.is_err() {
                log::warn!("No se pudo colocar la zona de Snap Layouts");
            }
        }
    }

    /// Cambia el estado con el bloqueo tomado y avisa a la interfaz ya sin él.
    fn update(change: impl FnOnce(&mut Overlay) -> Option<MaximizeButtonEvent>) -> bool {
        let (event, notify) = {
            let mut guard = overlay();
            let Some(state) = guard.as_mut() else {
                return false;
            };
            (change(state), Arc::clone(&state.notify))
        };
        if let Some(event) = event {
            notify(event);
        }
        true
    }

    /// Maximiza o restaura la ventana principal, como su botón nativo.
    fn toggle_maximize() {
        let Some(parent) = overlay().as_ref().map(|state| hwnd(state.parent)) else {
            return;
        };
        // SAFETY: la ventana principal sigue viva; el mensaje se procesa después, en su propio bucle.
        unsafe {
            let command = if IsZoomed(parent).as_bool() {
                SC_RESTORE
            } else {
                SC_MAXIMIZE
            };
            if PostMessageW(
                Some(parent),
                WM_SYSCOMMAND,
                WPARAM(command as usize),
                LPARAM(0),
            )
            .is_err()
            {
                log::warn!("No se pudo maximizar o restaurar la ventana");
            }
        }
    }

    unsafe extern "system" fn overlay_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match message {
            WM_NCHITTEST => return LRESULT(HTMAXBUTTON as isize),
            WM_NCMOUSEMOVE => {
                update(|state| {
                    let entered = !state.hovering;
                    state.hovering = true;
                    entered.then_some(MaximizeButtonEvent::Enter)
                });
                // Pide WM_NCMOUSELEAVE cuando el ratón salga.
                let mut track = TRACKMOUSEEVENT {
                    cbSize: size_of::<TRACKMOUSEEVENT>() as u32,
                    dwFlags: TME_LEAVE | TME_NONCLIENT,
                    hwndTrack: window,
                    dwHoverTime: 0,
                };
                // SAFETY: `track` es válido durante la llamada y `window` es esta ventana.
                let _ = unsafe { TrackMouseEvent(&mut track) };
                return LRESULT(0);
            }
            WM_NCMOUSELEAVE => {
                update(|state| {
                    state.hovering = false;
                    state.pressing = false;
                    Some(MaximizeButtonEvent::Leave)
                });
                return LRESULT(0);
            }
            // Se responden aquí: Windows no debe tratar la ventana nativa como si fuera una barra de título.
            WM_NCLBUTTONDOWN => {
                update(|state| {
                    state.pressing = true;
                    Some(MaximizeButtonEvent::Press)
                });
                return LRESULT(0);
            }
            WM_NCLBUTTONUP => {
                let mut clicked = false;
                update(|state| {
                    clicked = std::mem::replace(&mut state.pressing, false);
                    Some(MaximizeButtonEvent::Release)
                });
                if clicked {
                    toggle_maximize();
                }
                return LRESULT(0);
            }
            _ => {}
        }
        // SAFETY: los mensajes que no se tratan van al procedimiento por defecto, con sus argumentos tal cual.
        unsafe { DefWindowProcW(window, message, wparam, lparam) }
    }

    unsafe extern "system" fn parent_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        // SAFETY: el subclass reenvía el mensaje a la cadena con sus argumentos tal cual.
        let result = unsafe { DefSubclassProc(window, message, wparam, lparam) };
        match message {
            // Primero responde tao (el tamaño ya es el nuevo); después se recoloca la zona.
            WM_SIZE | WM_DPICHANGED => place(),
            WM_NCDESTROY => {
                // SAFETY: se quita el subclass que se instaló en esta misma ventana.
                let _ = unsafe { RemoveWindowSubclass(window, Some(parent_proc), SUBCLASS_ID) };
                *overlay() = None;
            }
            _ => {}
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn area(top: f64, right: f64, width: f64, height: f64) -> ButtonArea {
        ButtonArea::new(top, right, width, height).expect("zona válida")
    }

    #[test]
    fn accepts_a_title_bar_button() {
        assert!(ButtonArea::new(0.0, 46.0, 46.0, 36.0).is_some());
        assert!(ButtonArea::new(0.0, 0.0, 0.0, 0.0).is_some());
    }

    #[test]
    fn rejects_values_that_are_not_an_area() {
        for (top, right, width, height) in [
            (f64::NAN, 46.0, 46.0, 36.0),
            (0.0, f64::INFINITY, 46.0, 36.0),
            (0.0, -1.0, 46.0, 36.0),
            (0.0, 46.0, -46.0, 36.0),
            (0.0, 46.0, 46.0, 513.0),
            (16_385.0, 46.0, 46.0, 36.0),
        ] {
            assert_eq!(ButtonArea::new(top, right, width, height), None);
        }
    }

    #[test]
    fn places_the_area_from_the_right_edge() {
        assert_eq!(
            area(0.0, 46.0, 46.0, 36.0).to_physical(1280, 1.0),
            Some(PhysicalRect {
                x: 1188,
                y: 0,
                width: 46,
                height: 36
            })
        );
    }

    #[test]
    fn scales_to_physical_pixels() {
        // Al 125 %: 46 → 57,5 → 58; 36 → 45.
        assert_eq!(
            area(0.0, 46.0, 46.0, 36.0).to_physical(1600, 1.25),
            Some(PhysicalRect {
                x: 1484,
                y: 0,
                width: 58,
                height: 45
            })
        );
    }

    #[test]
    fn an_empty_area_has_no_rectangle() {
        assert_eq!(area(0.0, 46.0, 0.0, 36.0).to_physical(1280, 1.0), None);
        assert_eq!(area(0.0, 46.0, 46.0, 0.2).to_physical(1280, 1.0), None);
    }

    #[test]
    fn names_each_event() {
        assert_eq!(MaximizeButtonEvent::Enter.as_str(), "enter");
        assert_eq!(MaximizeButtonEvent::Leave.as_str(), "leave");
        assert_eq!(MaximizeButtonEvent::Press.as_str(), "press");
        assert_eq!(MaximizeButtonEvent::Release.as_str(), "release");
    }
}
