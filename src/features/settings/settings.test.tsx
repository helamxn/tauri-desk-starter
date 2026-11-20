import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { createUpdater } from "@/features/updater/updater-controller";
import { UpdaterProvider } from "@/features/updater/updater-provider";
import { PREFERENCES_KEY, savePreferences, DEFAULT_PREFERENCES } from "@/lib/preferences";
import { setThemeChoice, THEME_KEY } from "@/lib/theme";
import { isSettingsShortcut } from "./shortcut";
import { SETTINGS_SECTIONS } from "./sections";
import { GeneralSection } from "./sections/general-section";
import { SettingsMenu } from "./settings-menu";
import { SettingsProvider } from "./settings-provider";

// Las preferencias y el tema viven en memoria durante todo el archivo: cada test empieza con los de por defecto.
beforeEach(() => {
  savePreferences(DEFAULT_PREFERENCES);
  setThemeChoice("system");
  localStorage.clear();
});

// La primera vez, el diálogo se descarga (import()): puede tardar más que la espera por defecto.
const LOAD_TIMEOUT = { timeout: 5000 };

/** Un updater de prueba (como en la app de escritorio): sin búsquedas automáticas y sin versiones nuevas. */
function WithUpdater({ children }: { children: ReactNode }) {
  const [updater] = useState(() =>
    createUpdater({ check: () => Promise.resolve(null) }),
  );
  return (
    <UpdaterProvider updater={updater} automatic={false}>
      {children}
    </UpdaterProvider>
  );
}

function mount() {
  render(
    <WithUpdater>
      <SettingsProvider>
        <SettingsMenu />
      </SettingsProvider>
    </WithUpdater>,
  );
}

async function openFromMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Settings menu" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Settings/ }));
  return screen.findByRole("dialog", { name: "Settings" }, LOAD_TIMEOUT);
}


async function waitForClose() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });
}

describe("section registry", () => {
  it("defines General and Appearance with unique values and accessible labels", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.label)).toEqual(["General", "Appearance"]);
    const values = SETTINGS_SECTIONS.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
    for (const section of SETTINGS_SECTIONS) {
      expect(section.icon).toBeTruthy();
      expect(section.content).toBeTypeOf("function");
    }
  });
});

describe("settings shortcut", () => {
  const keyEvent = (options: KeyboardEventInit) => new KeyboardEvent("keydown", { key: ",", ...options });

  it("is Control+Comma", () => {
    expect(isSettingsShortcut(keyEvent({ ctrlKey: true }))).toBe(true);
    expect(isSettingsShortcut(keyEvent({ metaKey: true }))).toBe(false);
  });

  it("rejects other keys and extra modifiers", () => {
    expect(isSettingsShortcut(keyEvent({}))).toBe(false);
    expect(isSettingsShortcut(keyEvent({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSettingsShortcut(keyEvent({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isSettingsShortcut(new KeyboardEvent("keydown", { key: ".", ctrlKey: true }))).toBe(false);
  });
});

describe("Settings", () => {
  it("announces the settings shortcut in the menu", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Settings menu" }));
    const option = await screen.findByRole("menuitem", { name: /Settings/ });
    expect(option).toHaveTextContent("Ctrl+,");
    expect(option).toHaveAttribute("aria-keyshortcuts", "Control+,");
  });

  it("opens General from the menu", async () => {
    mount();
    await openFromMenu();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("group", { name: "General" })).toBeInTheDocument();
    // Las pestañas, en vertical a la izquierda, también para Base UI y los lectores de pantalla.
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("moves between sections with the up and down arrows", async () => {
    mount();
    await openFromMenu();
    screen.getByRole("tab", { name: "General" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Appearance" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("tab", { name: "General" })).toHaveFocus();
  });

  it("stays open after a click outside", async () => {
    mount();
    await openFromMenu();
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    if (backdrop) await userEvent.click(backdrop);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
  });

  it("toggles the dialog with the shortcut", async () => {
    mount();
    await userEvent.keyboard("{Control>},{/Control}");
    expect(await screen.findByRole("dialog", { name: "Settings" }, LOAD_TIMEOUT)).toBeInTheDocument();
    await userEvent.keyboard("{Control>},{/Control}");
    await waitForClose();
  });

  it("saves changes immediately on General", async () => {
    mount();
    await openFromMenu();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Automatic updates" }));
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "")).toMatchObject({ autoUpdate: false });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitForClose();
  });

  it("defaults to System and applies the chosen theme", async () => {
    mount();
    await openFromMenu();
    await userEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    const theme = await screen.findByRole("combobox", { name: "Theme" });
    expect(theme).toHaveTextContent("System");
    expect(screen.getByText("System follows the appearance of your operating system.")).toBeInTheDocument();
    await userEvent.click(theme);
    await userEvent.click(await screen.findByRole("option", { name: "Dark" }));
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("Dark");
    });
  });

  describe("General", () => {
    it("explains why Keep running is disabled in the browser", () => {
      render(<GeneralSection inTauri={false} />, { wrapper: WithUpdater });
      expect(screen.getByRole("switch", { name: "Keep the app running when closed" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(screen.getByText("Available in the desktop app.")).toBeInTheDocument();
    });

    it("saves Keep running on desktop", async () => {
      render(<GeneralSection inTauri />, { wrapper: WithUpdater });
      expect(screen.queryByText("Available in the desktop app.")).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("switch", { name: "Keep the app running when closed" }));
      expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "")).toMatchObject({ keepRunning: true });
      expect(screen.getByRole("switch", { name: "Keep the app running when closed" })).toBeChecked();
    });

    it("shows the app version", () => {
      render(<GeneralSection inTauri />, { wrapper: WithUpdater });
      expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument();
    });

    it("says that installing failed, not checking", async () => {
      const updater = createUpdater({
        check: () =>
          Promise.resolve({
            version: "0.2.0",
            currentVersion: "0.1.0",
            download: () => Promise.resolve(),
            install: () => Promise.reject(new Error("x")),
            close: () => Promise.resolve(),
          }),
      });
      render(
        <Toaster>
          <UpdaterProvider updater={updater} automatic={false}>
            <GeneralSection inTauri />
          </UpdaterProvider>
        </Toaster>,
      );
      await act(async () => {
        await updater.checkForUpdates();
        await updater.install();
      });
      expect(screen.getByText(`${__APP_VERSION__} · Couldn't install the update`)).toBeInTheDocument();
    });
  });
});
