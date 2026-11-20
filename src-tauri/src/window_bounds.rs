//! Que la ventana restaurada quepa en la pantalla. `tauri-plugin-window-state` devuelve el tamaño guardado aunque ya
//! no quepa: una ventana guardada en un monitor grande vuelve más grande que la pantalla del portátil, con la barra o
//! los bordes fuera de su alcance. Al arrancar, si es más grande que el área de trabajo de su monitor (sin la barra de
//! tareas), se encoge hasta caber y se coloca dentro; si cabe, no se toca, aunque esté parcialmente fuera (eso lo
//! decide el usuario).

use tauri::{PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

/// Un rectángulo en píxeles físicos.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// La ventana ajustada al área, o `None` si ya cabe.
pub fn fit(window: Rect, area: Rect) -> Option<Rect> {
    if window.width <= area.width && window.height <= area.height {
        return None;
    }
    let width = window.width.min(area.width);
    let height = window.height.min(area.height);
    let max_x = area.x.saturating_add_unsigned(area.width - width);
    let max_y = area.y.saturating_add_unsigned(area.height - height);
    Some(Rect {
        x: window.x.clamp(area.x, max_x),
        y: window.y.clamp(area.y, max_y),
        width,
        height,
    })
}

/// Aplica [`fit`] a la parte visible de la ventana (el área de cliente: sin marco, los bordes de redimensionado son
/// invisibles y quedan fuera) con el área de trabajo de su monitor (o del principal). `set_size` fija el área de
/// cliente y `set_position` la esquina exterior, así que se compensa la distancia entre las dos. Maximizada o a
/// pantalla completa ya ocupa justo su monitor: no se toca.
pub fn fit_to_screen<R: Runtime>(window: &WebviewWindow<R>) {
    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
        return;
    }
    let monitor = match window.current_monitor() {
        Ok(Some(monitor)) => monitor,
        _ => match window.primary_monitor() {
            Ok(Some(monitor)) => monitor,
            _ => return,
        },
    };
    let (Ok(outer), Ok(inner), Ok(size)) = (
        window.outer_position(),
        window.inner_position(),
        window.inner_size(),
    ) else {
        return;
    };
    let area = monitor.work_area();
    let current = Rect {
        x: inner.x,
        y: inner.y,
        width: size.width,
        height: size.height,
    };
    let target = Rect {
        x: area.position.x,
        y: area.position.y,
        width: area.size.width,
        height: area.size.height,
    };
    if let Some(fitted) = fit(current, target) {
        log::info!("La ventana guardada no cabía en la pantalla: se ajusta");
        let resized = window.set_size(PhysicalSize::new(fitted.width, fitted.height));
        let moved = window.set_position(PhysicalPosition::new(
            fitted.x - (inner.x - outer.x),
            fitted.y - (inner.y - outer.y),
        ));
        if resized.is_err() || moved.is_err() {
            log::warn!("No se pudo ajustar la ventana a la pantalla");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Rect = Rect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    };

    #[test]
    fn leaves_a_window_that_fits() {
        let window = Rect {
            x: 100,
            y: 50,
            width: 1600,
            height: 900,
        };
        assert_eq!(fit(window, AREA), None);
    }

    #[test]
    fn shrinks_and_moves_a_window_taller_than_the_screen() {
        let window = Rect {
            x: 100,
            y: 100,
            width: 1600,
            height: 65_535,
        };
        assert_eq!(
            fit(window, AREA),
            Some(Rect {
                x: 100,
                y: 0,
                width: 1600,
                height: 1040
            })
        );
    }

    #[test]
    fn uses_the_monitor_position() {
        let second = Rect {
            x: -1366,
            y: 0,
            width: 1366,
            height: 728,
        };
        let window = Rect {
            x: -1300,
            y: 20,
            width: 1600,
            height: 900,
        };
        assert_eq!(fit(window, second), Some(second));
    }
}
