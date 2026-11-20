import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/**
 * Pantalla de error: la del ErrorBoundary raíz y la de una sección que falla (defaultErrorComponent del router); la
 * barra sigue en su sitio cuando falla una sección. El error ya lo registra la raíz de React (main.tsx).
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
