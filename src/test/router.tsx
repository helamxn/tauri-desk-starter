// Ayuda para tests: renderiza un componente dentro de un router de memoria (para los que usan Link o useLocation).
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

export async function renderInRouter(ui: ReactNode, path = "/") {
  const root = createRootRoute({ component: () => ui });
  const children = ["/", "/example"].map((path) => createRoute({ getParentRoute: () => root, path, component: () => null }));
  const router = createRouter({ routeTree: root.addChildren(children), history: createMemoryHistory({ initialEntries: [path] }) });
  const result = render(<RouterProvider router={router} />);
  await router.load();
  return { ...result, router };
}
