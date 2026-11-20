import { createContext, use } from "react";

export interface SettingsControl {
  /** Abre Settings (carga el diálogo la primera vez). */
  open: () => void;
}

export const SettingsContext = createContext<SettingsControl | null>(null);

export function useSettings(): SettingsControl {
  const control = use(SettingsContext);
  if (!control) throw new Error("useSettings necesita un SettingsProvider por encima");
  return control;
}
