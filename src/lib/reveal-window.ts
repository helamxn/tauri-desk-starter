// La ventana nace oculta (`visible: false` en tauri.conf.json) para que no se vea el fondo blanco de WebView2 ni un
// primer fotograma con otro tema. La interfaz la muestra cuando ya ha pintado; si no llega a hacerlo, Rust la muestra
// igualmente a los pocos segundos (SHOW_FALLBACK en src-tauri/src/lib.rs).
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { logError } from "./log";

/** Muestra la ventana de la app. Fuera de la app de escritorio no hace nada. */
export function revealWindow(inTauri = isTauri()): void {
  if (!inTauri) return;
  getCurrentWindow()
    .show()
    .catch(() => {
      logError("No se pudo mostrar la ventana");
    });
}
