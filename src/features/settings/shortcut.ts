// El atajo de Settings: Ctrl+,. Lo abre y, con Settings abierto, lo cierra.

export function isSettingsShortcut(event: KeyboardEvent): boolean {
  return event.key === "," && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/** Cómo se ve en el menú. */
export const SHORTCUT_TEXT = "Ctrl+,";

/** Para aria-keyshortcuts. */
export const SHORTCUT_ARIA = "Control+,";
