import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSettingsShortcut } from "./shortcut";
import { SettingsContext } from "./settings-context";

// El diálogo no va en el bundle inicial: se descarga la primera vez que se abre.
const SettingsDialog = lazy(() => import("./settings-dialog").then((module) => ({ default: module.SettingsDialog })));

/** Settings para toda la app: abrirlo desde el menú (useSettings) o con Ctrl+,. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const control = useMemo(
    () => ({
      open: () => {
        setOpen(true);
      },
    }),
    [],
  );

  // El mismo atajo abre y cierra el diálogo.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSettingsShortcut(event)) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <SettingsContext value={control}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <SettingsDialog
            onClose={() => {
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </SettingsContext>
  );
}
