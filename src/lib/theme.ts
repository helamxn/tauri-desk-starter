// El tema: Light, Dark o System (sigue al sistema, también si cambia con la app abierta). Guardado en su propia clave.
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSyncExternalStore } from "react";
import { z } from "./zod";
import { createStoredValue, useStoredValue } from "./storage";

export const THEME_KEY = "theme:v1";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type AppliedTheme = Exclude<Theme, "system">;

const schema = z.enum(THEMES).catch("system");

/** El tema a partir del texto guardado (o de un valor cualquiera); lo que no sea un tema da "system". */
export function parseTheme(value: unknown): Theme {
  return schema.parse(value);
}

const theme = createStoredValue<Theme>(THEME_KEY, parseTheme, (value) => value);

export const getTheme = theme.get;
export const setThemeChoice = theme.save;

export function useTheme(): Theme {
  return useStoredValue(theme);
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function darkQuery(): MediaQueryList | undefined {
  return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : undefined;
}

function subscribeToSystem(listener: () => void): () => void {
  const query = darkQuery();
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}

/** Si el sistema está en oscuro; se vuelve a renderizar cuando cambia. */
export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribeToSystem, () => darkQuery()?.matches ?? false);
}

export function appliedTheme(selected: Theme, systemDark: boolean): AppliedTheme {
  if (selected !== "system") return selected;
  return systemDark ? "dark" : "light";
}

/** Pone la clase (light o dark) y color-scheme en el elemento (<html>). */
export function applyTheme(element: HTMLElement, applied: AppliedTheme): void {
  element.classList.toggle("dark", applied === "dark");
  element.classList.toggle("light", applied === "light");
  element.style.colorScheme = applied;
}

/**
 * En la app de escritorio, el tema también a la ventana nativa (System: el del sistema). En Windows, Tauri lo pasa a
 * WebView2, así que prefers-color-scheme y los controles nativos de la webview (barras de scroll, menús de los campos)
 * siguen al tema elegido. Fuera de Tauri no hace nada.
 */
export async function applyWindowTheme(selected: Theme, inTauri = isTauri()): Promise<void> {
  if (!inTauri) return;
  await getCurrentWindow().setTheme(selected === "system" ? null : selected);
}
