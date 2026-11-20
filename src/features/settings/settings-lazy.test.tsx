import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdaterProvider } from "@/features/updater/updater-provider";
import { SettingsMenu } from "./settings-menu";
import { SettingsProvider } from "./settings-provider";

// En su propio archivo: un módulo solo se carga una vez por archivo de tests.
const loads = vi.hoisted(() => ({ dialog: 0 }));
vi.mock("./settings-dialog", async (original) => {
  loads.dialog += 1;
  return original();
});

describe("lazy Settings", () => {
  it("loads the dialog on first open", async () => {
    render(
      <UpdaterProvider updater={null}>
        <SettingsProvider>
          <SettingsMenu />
        </SettingsProvider>
      </UpdaterProvider>,
    );
    expect(loads.dialog).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Settings menu" }));
    expect(loads.dialog).toBe(0);
    await userEvent.click(await screen.findByRole("menuitem", { name: /Settings/ }));
    // La primera carga (import()) puede tardar más que la espera por defecto.
    expect(await screen.findByRole("dialog", { name: "Settings" }, { timeout: 5000 })).toBeInTheDocument();
    expect(loads.dialog).toBe(1);
  });
});
