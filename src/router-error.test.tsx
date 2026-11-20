import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { rootErrorHandlers } from "./lib/error-reporting";
import { logError } from "./lib/log";
import { createAppRouter } from "./router";

// Una sección que falla al renderizar.
vi.mock("./features/home/home-page", () => ({
  HomePage: () => {
    throw new TypeError("fallo con datos del usuario");
  },
}));
vi.mock("./lib/log", () => ({ logError: vi.fn() }));

describe("route errors", () => {
  it("retains the title bar and logs a failed section without its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined); // En desarrollo, el error también va a la consola.
    render(<App router={createAppRouter(createMemoryHistory({ initialEntries: ["/"] }))} />, {
      onCaughtError: rootErrorHandlers.onCaughtError,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();

    const logged = vi.mocked(logError).mock.calls.map(([text]) => text);
    expect(logged.some((text) => text.startsWith("Error en la interfaz: TypeError"))).toBe(true);
    expect(logged.join("\n")).not.toContain("datos del usuario");
  });
});
