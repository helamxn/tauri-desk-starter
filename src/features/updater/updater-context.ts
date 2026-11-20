import { createContext, use } from "react";
import type { UpdaterState } from "./updater-state";

export interface UpdaterContextValue {
  state: UpdaterState;
  /** True en la app de escritorio, donde hay actualizaciones. */
  supported: boolean;
  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}

export const UpdaterContext = createContext<UpdaterContextValue | null>(null);

export function useUpdater(): UpdaterContextValue {
  const value = use(UpdaterContext);
  if (!value) throw new Error("useUpdater necesita un UpdaterProvider por encima");
  return value;
}
