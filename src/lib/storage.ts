// Datos guardados en localStorage: lectura y escritura que no fallan (el almacenamiento puede no estar disponible),
// valores observables para React y migraciones entre versiones de una clave.
//
// Aquí solo van las preferencias y el tema, nunca secretos. Las claves llevan versión (`preferences:v1`); la regla
// de versiones está en AGENTS.md (Datos guardados).
import { useSyncExternalStore } from "react";

/** El texto guardado en una clave, o null si no hay o el almacenamiento no está disponible. */
export function readText(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Guarda el texto; devuelve false si el almacenamiento no está disponible o está lleno. */
export function writeText(key: string, text: string): boolean {
  try {
    window.localStorage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

/** Borra la clave; si el almacenamiento no está disponible, no hace nada. */
export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

/** Un valor guardado en una clave y observable desde React con useSyncExternalStore. */
export interface StoredValue<T> {
  get: () => T;
  save: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Crea un valor guardado. Se lee la primera vez que se pide (no al importar el módulo), así las migraciones del
 * arranque ya han pasado. Si no se puede escribir, el valor cambia igual mientras la app sigue abierta.
 */
export function createStoredValue<T>(
  key: string,
  fromText: (text: string | null) => T,
  toText: (value: T) => string,
): StoredValue<T> {
  let loaded = false;
  let value: T;
  const listeners = new Set<() => void>();

  return {
    get() {
      if (!loaded) {
        value = fromText(readText(key));
        loaded = true;
      }
      return value;
    },
    save(next) {
      value = next;
      loaded = true;
      writeText(key, toText(next));
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** El valor actual, y se vuelve a renderizar cuando cambia. */
export function useStoredValue<T>(stored: StoredValue<T>): T {
  return useSyncExternalStore(stored.subscribe, stored.get, stored.get);
}

/**
 * Paso de una clave a su versión siguiente (`…:v1` → `…:v2`). `convert` recibe el texto antiguo y devuelve el
 * nuevo, o null si el antiguo no sirve (entonces la clave nueva toma sus valores por defecto).
 */
export interface Migration {
  from: string;
  to: string;
  convert: (text: string) => string | null;
}

/**
 * Ejecuta las migraciones en orden, al arrancar y antes de leer ningún valor:
 * - si la clave nueva ya existe, no se toca y la antigua se borra;
 * - si no, se escribe la conversión y, cuando se ha podido escribir (o la antigua no servía), se borra la antigua.
 * Nunca toca claves que no conoce: una versión anterior de la app que encuentra datos más nuevos los ignora sin
 * borrarlos.
 */
export function migrate(migrations: readonly Migration[]): void {
  for (const { from, to, convert } of migrations) {
    const old = readText(from);
    if (old === null) continue;
    if (readText(to) !== null) {
      removeKey(from);
      continue;
    }
    const next = convert(old);
    if (next === null || writeText(to, next)) removeKey(from);
  }
}
