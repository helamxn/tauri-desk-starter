import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "./updater-context";

/** «Update from X to Y»: se carga al abrirlo por primera vez (no va en el bundle inicial). */
export function UpdateDialog() {
  const { state, install, dialogOpen, setDialogOpen } = useUpdater();
  if (state.status !== "ready" && state.status !== "installing") return null;

  const { update } = state;
  const installing = state.status === "installing";

  return (
    <AlertDialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!installing) setDialogOpen(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Update from {update.currentVersion} to {update.version}
          </AlertDialogTitle>
          <AlertDialogDescription>Save your work first: the app restarts to install the update.</AlertDialogDescription>
        </AlertDialogHeader>
        {update.notes && (
          // Las notas llegan en texto plano (latest.json): se respetan sus saltos de línea y hacen scroll si son largas.
          <p className="max-h-48 overflow-y-auto whitespace-pre-line">{update.notes}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={installing}>Later</AlertDialogCancel>
          <Button onClick={() => void install()} disabled={installing}>
            {installing && <Spinner data-icon="inline-start" />}
            Restart and update
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
