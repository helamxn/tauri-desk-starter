// El provider (búsquedas automáticas y avisos) y el indicador de la barra, con un updater de prueba.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { UpdateIndicator } from "./update-indicator";
import { createUpdater, type DownloadEvent, type UpdatePackage, type Updater } from "./updater-controller";
import { CHECK_INTERVAL_MS, FIRST_CHECK_MS, UpdaterProvider } from "./updater-provider";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

function pkg(onDownload?: (onEvent: (event: DownloadEvent) => void) => Promise<void>): UpdatePackage {
  return {
    version: "0.2.0",
    currentVersion: "0.1.0",
    body: "Faster startup.",
    download: vi.fn((onEvent?: (event: DownloadEvent) => void) =>
      onDownload ? onDownload(onEvent ?? (() => undefined)) : Promise.resolve(),
    ),
    install: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
}

function Harness({ updater, automatic, children }: { updater: Updater; automatic: boolean; children?: ReactNode }) {
  return (
    <Toaster>
      <UpdaterProvider updater={updater} automatic={automatic}>
        <UpdateIndicator />
        {children}
      </UpdaterProvider>
    </Toaster>
  );
}

describe("UpdaterProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks after five seconds and every six hours", async () => {
    vi.useFakeTimers();
    const check = vi.fn(() => Promise.resolve(null));
    render(<Harness updater={createUpdater({ check })} automatic />);
    expect(check).not.toHaveBeenCalled();
    // Async: la búsqueda termina (su promesa se resuelve) antes del siguiente ciclo.
    await act(() => vi.advanceTimersByTimeAsync(FIRST_CHECK_MS));
    expect(check).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["in production", false, 1],
    ["but never in development", true, 0],
  ])("follows Automatic updates %s", async (_, dev, checks) => {
    vi.useFakeTimers();
    vi.stubEnv("DEV", dev);
    const check = vi.fn(() => Promise.resolve(null));
    // Sin `automatic`: decide la preferencia (activada por defecto) y el modo de compilación.
    render(
      <Toaster>
        <UpdaterProvider updater={createUpdater({ check })}>{null}</UpdaterProvider>
      </Toaster>,
    );
    await act(() => vi.advanceTimersByTimeAsync(FIRST_CHECK_MS));
    expect(check).toHaveBeenCalledTimes(checks);
    vi.unstubAllEnvs();
  });

  it("skips automatic checks when disabled", () => {
    vi.useFakeTimers();
    const check = vi.fn(() => Promise.resolve(null));
    render(<Harness updater={createUpdater({ check })} automatic={false} />);
    act(() => {
      vi.advanceTimersByTime(CHECK_INTERVAL_MS * 2);
    });
    expect(check).not.toHaveBeenCalled();
  });

  it("reports manual up-to-date results", async () => {
    const updater = createUpdater({ check: () => Promise.resolve(null) });
    render(<Harness updater={updater} automatic={false} />);
    await act(() => updater.checkForUpdates());
    expect(screen.queryByText("You have the latest version")).not.toBeInTheDocument();
    await act(() => updater.checkForUpdates({ manual: true }));
    expect(await screen.findByText("You have the latest version")).toBeInTheDocument();
  });

  it("reports only manual check failures", async () => {
    const updater = createUpdater({ check: () => Promise.reject(new Error("x")) });
    render(<Harness updater={updater} automatic={false} />);
    await act(() => updater.checkForUpdates());
    expect(screen.queryByText("Couldn't update.")).not.toBeInTheDocument();
    await act(() => updater.checkForUpdates({ manual: true }));
    expect(await screen.findByText("Couldn't update.")).toBeInTheDocument();
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument();
  });
});

describe("UpdateIndicator", () => {
  it("hides the indicator when idle", () => {
    const updater = createUpdater({ check: () => Promise.resolve(null) });
    render(<Harness updater={updater} automatic={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
  });

  it("shows download progress", async () => {
    let finish: () => void = () => undefined;
    const found = pkg((onEvent) => {
      onEvent({ event: "Started", data: { contentLength: 200 } });
      onEvent({ event: "Progress", data: { chunkLength: 50 } });
      return new Promise((ok) => (finish = ok));
    });
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    render(<Harness updater={updater} automatic={false} />);
    let checkResult: Promise<void> = Promise.resolve();
    act(() => {
      checkResult = updater.checkForUpdates();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Downloading update 25%");
    await act(async () => {
      finish();
      await checkResult;
    });
  });

  it("reviews a ready update from the toast and installs on request", async () => {
    const found = pkg();
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    render(<Harness updater={updater} automatic={false} />);
    await act(() => updater.checkForUpdates());

    expect(await screen.findByText("Update ready")).toBeInTheDocument();
    expect(screen.getByText("Version 0.2.0 is ready to install.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Update from 0.1.0 to 0.2.0" }, { timeout: 5000 });
    expect(dialog).toHaveTextContent("Faster startup.");
    await userEvent.click(screen.getByRole("button", { name: "Restart and update" }));
    await waitFor(() => {
      expect(found.install).toHaveBeenCalledTimes(1);
    });
  });

  it("does not reopen the dialog by itself after a failed installation", async () => {
    // La primera instalación falla; la búsqueda siguiente vuelve a dejar un paquete listo.
    const failing = pkg();
    vi.mocked(failing.install).mockRejectedValueOnce(new Error("x"));
    const packages = [failing, pkg()];
    const updater = createUpdater({ check: () => Promise.resolve(packages.shift() ?? null) });
    render(<Harness updater={updater} automatic={false} />);
    await act(() => updater.checkForUpdates());

    await userEvent.click(await screen.findByRole("button", { name: "Update" }));
    await screen.findByRole("alertdialog", { name: "Update from 0.1.0 to 0.2.0" }, { timeout: 5000 });
    await userEvent.click(screen.getByRole("button", { name: "Restart and update" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    await act(() => updater.checkForUpdates());
    expect(await screen.findByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("opens the update from the title bar and dismisses it with Later", async () => {
    const found = pkg();
    function WithState() {
      const [updater] = useState(() =>
        createUpdater({ check: () => Promise.resolve(found) }),
      );
      return (
        <Harness updater={updater} automatic={false}>
          <button type="button" onClick={() => void updater.checkForUpdates()}>
            Buscar
          </button>
        </Harness>
      );
    }
    render(<WithState />);
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Update" }));
    await screen.findByRole("alertdialog", { name: "Update from 0.1.0 to 0.2.0" }, { timeout: 5000 });
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(found.install).not.toHaveBeenCalled();
  });
});
