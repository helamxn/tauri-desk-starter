// Migraciones de los datos guardados, en orden. Se ejecutan en main.tsx antes de pintar la app.
//
// La plantilla no trae ninguna: todas las claves están en su primera versión. Un cambio incompatible en una clave añade aquí su
// paso, con su test, y la constante de la clave (PREFERENCES_KEY en preferences.ts) pasa a `:v2`. Por ejemplo:
//
//   {
//     from: "preferences:v1",   // la clave anterior, escrita tal cual
//     to: PREFERENCES_KEY,      // ya «preferences:v2»
//     convert: (text) => JSON.stringify(v1ToV2(JSON.parse(text))),
//   },
import { migrate, type Migration } from "./storage";

export const MIGRATIONS: readonly Migration[] = [];

export function migrateStorage(): void {
  migrate(MIGRATIONS);
}
