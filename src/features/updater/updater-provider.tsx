import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import { usePreferences } from "@/lib/preferences";
import { UpdaterContext, type UpdaterContextValue } from "./updater-context";
import { createUpdater, type Updater } from "./updater-controller";
import { INITIAL_STATE } from "./updater-state";

export const CHECK_TIMEOUT_MS = 30_000;
export const FIRST_CHECK_MS = 5_000;
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** El updater del plugin de Tauri; null fuera de la app de escritorio. */
function createTauriUpdater(): Updater | null {
  if (!isTauri()) return null;
  return createUpdater({ check: () => check({ timeout: CHECK_TIMEOUT_MS }) });
}

const noSubscription = () => () => undefined;
const initialState = () => INITIAL_STATE;

interface UpdaterProviderProps {
  children: ReactNode;
  /** Por defecto, el del plugin de Tauri; los tests pasan el suyo. */
  updater?: Updater | null;
  /** Buscar a los 5 s de arrancar y luego cada 6 h. Por defecto, la preferencia «Automatic updates», salvo en desarrollo. */
  automatic?: boolean;
}

/**
 * Las actualizaciones para toda la app. Las búsquedas automáticas fallan en silencio (al log); las manuales avisan
 * con un toast, igual que un paquete listo («Update ready» → «Review»).
 */
export function UpdaterProvider({ children, updater: received, automatic: automaticOverride }: UpdaterProviderProps) {
  const { autoUpdate } = usePreferences();
  // En desarrollo (`tauri dev`) no se busca sola: el endpoint de la plantilla no existe hasta publicar, cada arranque
  // dejaría un error en el log y una versión publicada no debe sustituir a la que se está desarrollando. «Check for
  // updates» sigue disponible para probar el updater con un servidor local (docs/release.md).
  const automatic = automaticOverride ?? (autoUpdate && !import.meta.env.DEV);
  const [updater] = useState<Updater | null>(() => (received === undefined ? createTauriUpdater() : received));
  const [dialogOpen, setDialogOpen] = useState(false);
  const state = useSyncExternalStore(
    updater ? updater.subscribe : noSubscription,
    updater ? updater.getState : initialState,
  );

  // Sin un paquete listo o instalándose no hay diálogo: si la instalación falla, se cierra. Si no, seguiría abierto por
  // dentro y aparecería solo cuando la búsqueda siguiente volviera a dejar un paquete listo.
  const hasPackage = state.status === "ready" || state.status === "installing";
  if (dialogOpen && !hasPackage) setDialogOpen(false);

  useEffect(() => {
    if (!updater || !automatic) return;
    const first = window.setTimeout(() => void updater.checkForUpdates(), FIRST_CHECK_MS);
    const interval = window.setInterval(() => void updater.checkForUpdates(), CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [updater, automatic]);

  useEffect(
    () => () => {
      void updater?.dispose();
    },
    [updater],
  );

  // Cada objeto de estado es una transición nueva: cada aviso sale una vez.
  useEffect(() => {
    if (state.status === "ready") {
      toast.add({
        title: "Update ready",
        description: `Version ${state.update.version} is ready to install.`,
        actionProps: {
          children: "Review",
          onClick: () => {
            setDialogOpen(true);
          },
        },
      });
    } else if (state.status === "error" && state.manual) {
      toast.add({ type: "error", title: "Couldn't update.", description: state.message });
    } else if (state.status === "up-to-date" && state.manual) {
      toast.add({ type: "success", title: "You have the latest version" });
    }
  }, [state]);

  const value = useMemo<UpdaterContextValue>(
    () => ({
      state,
      supported: updater !== null,
      checkForUpdates: (options) => updater?.checkForUpdates(options) ?? Promise.resolve(),
      install: () => updater?.install() ?? Promise.resolve(),
      dialogOpen,
      setDialogOpen,
    }),
    [state, updater, dialogOpen],
  );

  return <UpdaterContext value={value}>{children}</UpdaterContext>;
}
