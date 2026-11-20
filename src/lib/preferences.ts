// Preferencias del equipo, en localStorage. Validadas con zod: un valor inválido vuelve a su valor por defecto y las
// claves desconocidas se descartan. Nunca guardan secretos ni deciden qué puede hacer el usuario.
import { z } from "./zod";
import { createStoredValue, useStoredValue } from "./storage";

// Sin el nombre de la app: en la app, localStorage vive en el perfil de WebView2 de su propio directorio de datos.
export const PREFERENCES_KEY = "preferences:v1";

const schema = z.object({
  /** Buscar y descargar actualizaciones en segundo plano. */
  autoUpdate: z.boolean().catch(true),
  /** Al cerrar la ventana, la app sigue en la bandeja. */
  keepRunning: z.boolean().catch(false),
});

export type Preferences = z.infer<typeof schema>;

export const DEFAULT_PREFERENCES: Preferences = schema.parse({});

/** Las preferencias a partir del texto guardado; cualquier cosa que no sirva da los valores por defecto. */
export function parsePreferences(text: string | null): Preferences {
  if (text === null) return DEFAULT_PREFERENCES;
  try {
    return schema.catch(DEFAULT_PREFERENCES).parse(JSON.parse(text));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const preferences = createStoredValue(PREFERENCES_KEY, parsePreferences, (value) => JSON.stringify(value));

export const getPreferences = preferences.get;

export function savePreferences(changes: Partial<Preferences>): void {
  preferences.save({ ...preferences.get(), ...changes });
}

export function usePreferences(): Preferences {
  return useStoredValue(preferences);
}
