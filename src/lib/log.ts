// Errores del frontend al archivo de log de la app (tauri-plugin-log). En release no hay consola: lo que solo fuera a
// console.error se perdería. Nunca se registran secretos ni preferencias.
import { isTauri } from "@tauri-apps/api/core";
import { error as writeError } from "@tauri-apps/plugin-log";


/** Registra un error con un mensaje propio. Fuera de la app de escritorio (navegador), va a la consola. */
export function logError(text: string): void {
  if (!isTauri()) {
    console.error(text);
    return;
  }
  writeError(text).catch(() => {
    // Si el propio log falla no hay otro destino posible en release; en desarrollo, la consola.
    if (import.meta.env.DEV) console.error(text);
  });
}
