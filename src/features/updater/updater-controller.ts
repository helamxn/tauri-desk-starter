// El controlador del updater: busca una actualización firmada, la descarga en segundo plano en cuanto la hay y la
// instala solo cuando se pide. `check` se inyecta (la app pasa el del plugin; los tests, el suyo). El plugin verifica la
// firma del paquete con la clave pública de tauri.conf.json antes de instalarlo. No hay paso de reinicio: en Windows,
// `install()` cierra la app y el instalador (modo pasivo) la vuelve a abrir al terminar.
import { logError } from "@/lib/log";
import {
  INITIAL_STATE,
  isBusy,
  updaterReducer,
  type UpdateInfo,
  type UpdaterAction,
  type UpdaterState,
} from "./updater-state";

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

/** La parte del recurso `Update` del plugin que usa la app. */
export interface UpdatePackage {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
  download: (onEvent?: (event: DownloadEvent) => void) => Promise<void>;
  install: () => Promise<void>;
  close: () => Promise<void>;
}

export interface UpdaterDeps {
  /** Una actualización firmada más nueva que la versión en uso, o null. */
  check: () => Promise<UpdatePackage | null>;
  now?: () => number;
}

// Propiedades con funciones flecha, no métodos: se pasan sueltas (useSyncExternalStore) sin depender de `this`.
export interface Updater {
  getState: () => UpdaterState;
  subscribe: (listener: () => void) => () => void;
  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dispose: () => Promise<void>;
}

/** El log conserva el contexto fijo de la operación y la interfaz indica cómo reintentar. */
function failure(context: string, message: string): UpdaterAction {
  logError(context);
  return { type: "failed", message: message };
}

function toInfo(pkg: UpdatePackage): UpdateInfo {
  const notes = pkg.body?.trim();
  return {
    version: pkg.version,
    currentVersion: pkg.currentVersion,
    date: pkg.date ?? null,
    // Unas notas vacías («» o solo espacios) son lo mismo que ninguna.
    notes: notes === undefined || notes === "" ? null : notes,
  };
}

export function createUpdater(deps: UpdaterDeps): Updater {
  const now = deps.now ?? Date.now;
  const listeners = new Set<() => void>();
  let state = INITIAL_STATE;
  let pending: UpdatePackage | null = null;

  function dispatch(action: UpdaterAction) {
    const next = updaterReducer(state, action);
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  /** Suelta el paquete descargado (el recurso del plugin). */
  async function releaseResource() {
    const current = pending;
    pending = null;
    await current?.close().catch(() => undefined);
  }

  async function checkForUpdates({ manual = false }: { manual?: boolean } = {}) {
    if (isBusy(state)) return;
    dispatch({ type: "check-started", manual });
    try {
      const found = await deps.check();
      if (!found) {
        dispatch({ type: "check-finished", update: null, at: now() });
        return;
      }
      await releaseResource();
      pending = found;
      dispatch({ type: "check-finished", update: toInfo(found), at: now() });
      await found.download((event) => {
        if (event.event === "Started") {
          dispatch({ type: "download-started", total: event.data.contentLength ?? null });
        } else if (event.event === "Progress") {
          dispatch({ type: "download-progress", chunk: event.data.chunkLength });
        }
      });
      dispatch({ type: "download-finished" });
    } catch {
      await releaseResource();
      dispatch(failure("No se pudo buscar o descargar la actualización", "Check your connection and try again."));
    }
  }

  async function install() {
    if (state.status !== "ready" || !pending) return;
    const pkg = pending;
    dispatch({ type: "install-started" });
    try {
      // Si sale bien, no vuelve: el plugin lanza el instalador y cierra la app, y el instalador la vuelve a abrir.
      await pkg.install();
    } catch {
      await releaseResource();
      dispatch(failure("No se pudo instalar la actualización", "Try again."));
    }
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    checkForUpdates,
    install,
    dispose: releaseResource,
  };
}
