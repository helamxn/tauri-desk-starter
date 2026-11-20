// Máquina de estados del updater, pura: buscar → descargar → listo → instalar, con `manual` en los estados donde un
// fallo o un resultado se avisan solo si los pidió el usuario.

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date: string | null;
  notes: string | null;
}

export type UpdaterState =
  | { status: "idle" }
  | { status: "checking"; manual: boolean }
  | { status: "up-to-date"; checkedAt: number; manual: boolean }
  | { status: "downloading"; update: UpdateInfo; downloaded: number; total: number | null; manual: boolean }
  | { status: "ready"; update: UpdateInfo }
  | { status: "installing"; update: UpdateInfo }
  | { status: "error"; message: string; manual: boolean; stage: "check" | "install" };

export type UpdaterAction =
  | { type: "check-started"; manual: boolean }
  | { type: "check-finished"; update: UpdateInfo | null; at: number }
  | { type: "download-started"; total: number | null }
  | { type: "download-progress"; chunk: number }
  | { type: "download-finished" }
  | { type: "install-started" }
  | { type: "failed"; message: string };

export const INITIAL_STATE: UpdaterState = { status: "idle" };

/** Una búsqueda, una descarga, un paquete listo o una instalación en curso no se sustituyen por una búsqueda nueva. */
export function isBusy(state: UpdaterState): boolean {
  return (
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "ready" ||
    state.status === "installing"
  );
}

export function updaterReducer(state: UpdaterState, action: UpdaterAction): UpdaterState {
  switch (action.type) {
    case "check-started":
      return isBusy(state) ? state : { status: "checking", manual: action.manual };

    case "check-finished":
      if (state.status !== "checking") return state;
      return action.update
        ? { status: "downloading", update: action.update, downloaded: 0, total: null, manual: state.manual }
        : { status: "up-to-date", checkedAt: action.at, manual: state.manual };

    case "download-started":
      if (state.status !== "downloading") return state;
      return { ...state, downloaded: 0, total: action.total && action.total > 0 ? action.total : null };

    case "download-progress":
      if (state.status !== "downloading") return state;
      return { ...state, downloaded: state.downloaded + Math.max(0, action.chunk) };

    case "download-finished":
      return state.status === "downloading" ? { status: "ready", update: state.update } : state;

    case "install-started":
      return state.status === "ready" ? { status: "installing", update: state.update } : state;

    case "failed": {
      if (state.status === "idle" || state.status === "up-to-date" || state.status === "error") return state;
      // Las búsquedas y descargas en segundo plano fallan en silencio y se reintentan en el siguiente ciclo; una
      // búsqueda que pidió el usuario, o una instalación que confirmó, avisa de su fallo.
      const manual = state.status === "checking" || state.status === "downloading" ? state.manual : true;
      // Qué falló: buscar o descargar, o instalar (Settings lo dice junto a la versión).
      const stage = state.status === "installing" ? "install" : "check";
      return { status: "error", message: action.message, manual, stage };
    }
  }
}

/** Progreso de la descarga de 0 a 100, o null mientras no se conoce el tamaño. */
export function downloadPercent(state: UpdaterState): number | null {
  if (state.status !== "downloading" || !state.total) return null;
  return Math.min(100, Math.round((state.downloaded / state.total) * 100));
}
