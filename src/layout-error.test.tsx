import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import { createAppRouter } from "./router";

// Falla el diseño común (una pieza de la barra), no una sección.
vi.mock("./features/settings/settings-menu", () => ({
  SettingsMenu: () => {
    throw new Error("fallo en la barra");
  },
}));
vi.mock("./lib/log", () => ({ logError: vi.fn() }));

describe("layout errors", () => {
  it("keeps a title bar so the window can still be moved and closed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<App router={createAppRouter(createMemoryHistory({ initialEntries: ["/"] }))} />, {
      onCaughtError: () => undefined,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("banner")).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("alert"));
    // Sin la navegación: puede ser lo que ha fallado.
    expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument();
  });
});
