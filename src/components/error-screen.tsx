import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { AppShell } from "./app-shell";

/**
 * Pantalla de error de una sección que falla (defaultErrorComponent del router): ocupa el sitio de la sección, centrada,
 * y la barra sigue en su sitio. El error ya lo registra la raíz de React (main.tsx).
 */
export function ErrorScreen() {
  return (
    <Empty role="alert" className="h-full">
      <EmptyHeader>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>Reload to try again.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/**
 * Pantalla de error cuando falla la app entera (el ErrorBoundary raíz o el diseño común): con su propia barra de título,
 * sin navegación ni acciones (pueden ser lo que ha fallado), así que la ventana se sigue pudiendo mover y cerrar.
 */
export function AppErrorScreen() {
  return (
    <AppShell>
      <ErrorScreen />
    </AppShell>
  );
}
