import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { UpdaterProvider } from "@/features/updater/updater-provider";
import { useKeepRunning } from "@/lib/keep-running";
import { blockContextMenu } from "@/lib/context-menu";
import { revealWindow } from "@/lib/reveal-window";
import { router as appRouter } from "@/router";

/**
 * La app: el tema (también para la pantalla de error), los avisos (toasts), las actualizaciones y el ErrorBoundary raíz
 * alrededor del router; en release, sin el menú contextual del navegador.
 */
export function App({ router = appRouter }: { router?: typeof appRouter }) {
  useEffect(() => (import.meta.env.PROD ? blockContextMenu() : undefined), []);
  // Los efectos de la app van después de los de sus hijos: el tema ya está aplicado (ThemeProvider) al mostrarla.
  useEffect(() => {
    revealWindow();
  }, []);
  // Keep running se aplica durante toda la vida de la app, desde el arranque.
  useKeepRunning();

  return (
    <ThemeProvider>
      <Toaster>
        <UpdaterProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </UpdaterProvider>
      </Toaster>
    </ThemeProvider>
  );
}
