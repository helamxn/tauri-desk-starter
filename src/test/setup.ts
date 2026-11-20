// Preparación común de los tests de Vitest: los matchers de Testing Library (toBeInTheDocument…)
// y la limpieza del DOM después de cada test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom no implementa scrollTo, que el router usa al cambiar de sección.
window.scrollTo = () => undefined;

// jsdom no implementa matchMedia (el tema System lo usa): el sistema, en claro. Un test puede sustituirlo.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

afterEach(() => {
  cleanup();
  localStorage.clear();
});
