import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { AppErrorScreen, ErrorScreen } from "@/components/error-screen";
import { ExamplePage } from "@/features/example/example-page";
import { HomePage } from "@/features/home/home-page";

// Si falla el diseño común, no queda barra: la pantalla de error trae la suya.
const root = createRootRoute({ component: AppLayout, errorComponent: () => <AppErrorScreen /> });
const paths = [
  createRoute({ getParentRoute: () => root, path: "/", component: HomePage }),
  createRoute({ getParentRoute: () => root, path: "/example", component: ExamplePage }),
];

/**
 * El router: historial hash (en escritorio no hay servidor; #/example funciona al recargar). Una sección que falla
 * deja su sitio a la pantalla de error y la barra sigue.
 */
export function createAppRouter(history = createHashHistory()) {
  return createRouter({
    routeTree: root.addChildren(paths),
    history,
    defaultErrorComponent: () => <ErrorScreen />,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
