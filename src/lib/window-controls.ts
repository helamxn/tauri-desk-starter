// Los botones de la ventana sin marco (minimizar, maximizar o restaurar, cerrar), sin framework: DOM y la API de
// Tauri. `mountWindowControls(contenedor)` los crea dentro del elemento y devuelve cómo quitarlos; sirve igual desde
// React o desde cualquier otro frontend. Los estilos están en window-controls.css.
//
// Snap Layouts: Windows solo muestra su menú si el botón de maximizar responde como uno nativo, y eso lo hace una
// ventana nativa invisible que Rust coloca encima (src-tauri/src/window_controls.rs). Este módulo le envía la zona del
// botón medida en el DOM y pinta el hover y la pulsación que esa ventana le avisa, porque el ratón lo recibe ella.
import "./window-controls.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { logError } from "./log";

/** El evento que emite Rust con lo que hace el ratón sobre el botón de maximizar. */
export const MAXIMIZE_EVENT = "window-controls://maximize";
const SET_AREA_COMMAND = "set_maximize_button_area";

/** Glifos de Segoe Fluent Icons (Windows 11) y Segoe MDL2 Assets (Windows 10), los de las ventanas nativas. */
const GLYPHS = { minimize: "", maximize: "", restore: "", close: "" } as const;

type Control = "minimize" | "maximize" | "close";

export interface MaximizeButtonArea {
  top: number;
  right: number;
  width: number;
  height: number;
}

/** La zona del botón en píxeles CSS, desde la esquina superior derecha de la ventana (como la espera Rust). */
export function maximizeButtonArea(button: Element, viewportWidth: number): MaximizeButtonArea {
  const rect = button.getBoundingClientRect();
  return {
    top: Math.max(0, rect.top),
    right: Math.max(0, viewportWidth - rect.right),
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  };
}

/** Qué se registra si falla la acción de cada botón. */
const FAILURES: Record<Control, string> = {
  minimize: "No se pudo minimizar la ventana",
  maximize: "No se pudo maximizar o restaurar la ventana",
  close: "No se pudo cerrar la ventana",
};

function createButton(control: Control, label: string, glyph: string, action: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.control = control;
  button.setAttribute("aria-label", label);
  // Como en las ventanas nativas, no están en el orden de Tab (con el teclado: Alt+F4, Win+flechas, Alt+Espacio).
  button.tabIndex = -1;
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = glyph;
  button.append(icon);
  button.addEventListener("click", () => {
    action().catch(() => {
      logError(FAILURES[control]);
    });
  });
  return button;
}

function showMaximized(button: HTMLButtonElement, maximized: boolean) {
  button.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
  const icon = button.firstElementChild;
  if (icon) icon.textContent = maximized ? GLYPHS.restore : GLYPHS.maximize;
}

/** Pinta lo que la ventana nativa avisa que hace el ratón sobre el botón de maximizar. */
export function applyMaximizeEvent(button: HTMLElement, event: unknown): void {
  if (event === "enter") button.toggleAttribute("data-hover", true);
  else if (event === "leave") {
    button.toggleAttribute("data-hover", false);
    button.toggleAttribute("data-pressed", false);
  } else if (event === "press") button.toggleAttribute("data-pressed", true);
  else if (event === "release") button.toggleAttribute("data-pressed", false);
}

/** Crea los botones dentro de `container` y devuelve la función que los quita y libera todo. */
export function mountWindowControls(container: HTMLElement): () => void {
  const appWindow = getCurrentWindow();
  const group = document.createElement("div");
  group.dataset.windowControls = "";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Window controls");
  const maximize = createButton("maximize", "Maximize", GLYPHS.maximize, () => appWindow.toggleMaximize());
  group.append(
    createButton("minimize", "Minimize", GLYPHS.minimize, () => appWindow.minimize()),
    maximize,
    createButton("close", "Close", GLYPHS.close, () => appWindow.close()),
  );
  container.append(group);

  let disposed = false;
  const syncMaximized = () => {
    appWindow
      .isMaximized()
      .then((maximized) => {
        if (!disposed) showMaximized(maximize, maximized);
      })
      .catch(() => {
        logError("No se pudo saber si la ventana está maximizada");
      });
  };
  syncMaximized();

  // La zona se envía solo cuando cambia. Sin requestAnimationFrame: la ventana nace oculta y no pinta hasta mostrarse.
  let sent = "";
  const sendArea = (area: MaximizeButtonArea) => {
    const key = JSON.stringify(area);
    if (key === sent) return;
    sent = key;
    invoke(SET_AREA_COMMAND, { ...area }).catch(() => {
      sent = "";
      logError("No se pudo colocar la zona de Snap Layouts");
    });
  };
  const reportArea = () => {
    if (!disposed) sendArea(maximizeButtonArea(maximize, document.documentElement.clientWidth));
  };
  const observer = new ResizeObserver(reportArea);
  observer.observe(maximize);
  window.addEventListener("resize", reportArea);
  const firstReport = window.setTimeout(reportArea, 0);

  const listeners = Promise.all([
    appWindow.onResized(syncMaximized),
    appWindow.listen<unknown>(MAXIMIZE_EVENT, ({ payload }) => {
      applyMaximizeEvent(maximize, payload);
    }),
  ]);
  listeners.catch(() => {
    logError("No se pudieron escuchar los cambios de la ventana");
  });

  return () => {
    disposed = true;
    window.clearTimeout(firstReport);
    observer.disconnect();
    window.removeEventListener("resize", reportArea);
    void listeners.then((unlisteners) => {
      for (const unlisten of unlisteners) unlisten();
    });
    // Sin botón, sin zona: la ventana nativa se oculta.
    sendArea({ top: 0, right: 0, width: 0, height: 0 });
    group.remove();
  };
}
