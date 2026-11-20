// Aplica «Keep the app running when closed» en la capa nativa, que decide qué pasa al cerrar la ventana y crea o quita
// el icono de la bandeja (src-tauri/src/lifecycle.rs).
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { logError } from "./log";
import { savePreferences, usePreferences } from "./preferences";

/**
 * Envía la preferencia al arrancar y en cada cambio. Si Rust no puede activarla (no se pudo crear la bandeja), la
 * preferencia vuelve a desactivada: el interruptor no puede quedar en «sí» con la opción sin aplicar.
 */
export function useKeepRunning(inTauri = isTauri()): void {
  const { keepRunning } = usePreferences();

  useEffect(() => {
    if (!inTauri) return;
    invoke("set_keep_running", { enabled: keepRunning }).catch(() => {
      logError("No se pudo aplicar Keep running");
      if (keepRunning) savePreferences({ keepRunning: false });
    });
  }, [inTauri, keepRunning]);
}
