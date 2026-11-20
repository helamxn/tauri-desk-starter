import type { ReactNode } from "react";
import { TitleBar } from "./title-bar";

/**
 * El marco de la ventana: la barra de título arriba y el contenido debajo, con su propio scroll. Lo usan el diseño de la
 * app y la pantalla de error que la sustituye entera, para que la ventana siempre se pueda mover, maximizar y cerrar.
 */
export function AppShell({ nav, actions, children }: { nav?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-svh flex-col">
      <TitleBar nav={nav} actions={actions} />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
