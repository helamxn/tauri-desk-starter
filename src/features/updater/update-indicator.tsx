import { DownloadIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "./updater-context";
import { downloadPercent } from "./updater-state";

// El diálogo no va en el bundle inicial: se descarga la primera vez que se abre.
const UpdateDialog = lazy(() => import("./update-dialog").then((module) => ({ default: module.UpdateDialog })));

/** En la barra de título: el progreso de la descarga y, con el paquete listo, «Update», que abre el diálogo. */
export function UpdateIndicator() {
  const { state, dialogOpen, setDialogOpen } = useUpdater();
  // Una vez cargado, el diálogo se queda montado: así se ve su animación al cerrarse.
  const [loaded, setLoaded] = useState(false);
  if (dialogOpen && !loaded) setLoaded(true);

  if (state.status === "downloading") {
    const percent = downloadPercent(state);
    return (
      <Badge variant="secondary" role="status">
        {/* Lo que se anuncia es el texto; el spinner es decorativo. En una barra estrecha solo se ve el porcentaje. */}
        <Spinner aria-hidden="true" role="presentation" data-icon="inline-start" />
        <span className={percent === null ? undefined : "sr-only @xl/titlebar:not-sr-only"}>Downloading update</span>
        {percent !== null && ` ${String(percent)}%`}
      </Badge>
    );
  }

  if (state.status !== "ready" && state.status !== "installing") return null;
  const installing = state.status === "installing";

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={installing}
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        {installing ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
        {installing ? "Updating…" : "Update"}
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <UpdateDialog />
        </Suspense>
      )}
    </>
  );
}
