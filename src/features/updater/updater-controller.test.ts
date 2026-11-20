const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/log", () => ({ logError }));

import { createUpdater, type DownloadEvent, type UpdatePackage } from "./updater-controller";

function pkg(changes: Partial<UpdatePackage> = {}): UpdatePackage {
  return {
    version: "0.2.0",
    currentVersion: "0.1.0",
    date: "2026-11-19",
    body: "  Fixes.  ",
    download: vi.fn((onEvent?: (event: DownloadEvent) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
      onEvent?.({ event: "Finished" });
      return Promise.resolve();
    }),
    install: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    ...changes,
  };
}

describe("createUpdater", () => {
  it("reports up to date when no update exists", async () => {
    const updater = createUpdater({ check: () => Promise.resolve(null), now: () => 7 });
    await updater.checkForUpdates({ manual: true });
    expect(updater.getState()).toEqual({ status: "up-to-date", checkedAt: 7, manual: true });
  });

  it("downloads a new version and reports progress", async () => {
    const found = pkg();
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    const states: string[] = [];
    updater.subscribe(() => states.push(updater.getState().status));
    await updater.checkForUpdates();
    expect(found.download).toHaveBeenCalledTimes(1);
    expect(updater.getState()).toEqual({
      status: "ready",
      update: { version: "0.2.0", currentVersion: "0.1.0", date: "2026-11-19", notes: "Fixes." },
    });
    expect(states).toEqual(["checking", "downloading", "downloading", "downloading", "downloading", "ready"]);
  });

  it("treats empty notes as absent", async () => {
    const updater = createUpdater({
      check: () => Promise.resolve(pkg({ body: "   " })),
    });
    await updater.checkForUpdates();
    expect(updater.getState()).toMatchObject({ update: { notes: null } });
  });

  it("ignores repeat checks while checking", async () => {
    let resolveValue: (value: UpdatePackage | null) => void = () => undefined;
    const check = vi.fn(() => new Promise<UpdatePackage | null>((ok) => (resolveValue = ok)));
    const updater = createUpdater({ check });
    const first = updater.checkForUpdates();
    await updater.checkForUpdates({ manual: true });
    expect(check).toHaveBeenCalledTimes(1);
    resolveValue(null);
    await first;
  });

  it("logs a fixed event and suggests recovery after a failed check", async () => {
    const updater = createUpdater({
      check: () => Promise.reject(new Error("error sending request")),
    });
    await updater.checkForUpdates({ manual: true });
    expect(updater.getState()).toEqual({
      status: "error",
      message: "Check your connection and try again.",
      manual: true,
      stage: "check",
    });
    expect(logError).toHaveBeenCalledWith("No se pudo buscar o descargar la actualización");
  });

  it("releases the package after a failed download", async () => {
    const found = pkg({ download: vi.fn(() => Promise.reject(new Error("signature mismatch"))) });
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    await updater.checkForUpdates();
    expect(updater.getState()).toMatchObject({ status: "error", manual: false });
    expect(found.close).toHaveBeenCalled();
  });

  it("installs only on request", async () => {
    const found = pkg();
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    await updater.checkForUpdates();
    expect(found.install).not.toHaveBeenCalled();
    await updater.install();
    expect(found.install).toHaveBeenCalledTimes(1);
    // En Windows el plugin cierra la app al instalar: mientras tanto, la interfaz muestra que está instalando.
    expect(updater.getState()).toMatchObject({ status: "installing" });
  });

  it("skips installation without a ready package", async () => {
    const updater = createUpdater({ check: () => Promise.resolve(null) });
    await updater.install();
    expect(updater.getState()).toEqual({ status: "idle" });
  });

  it("reports installation failures and releases the package", async () => {
    const found = pkg({ install: vi.fn(() => Promise.reject(new Error("x"))) });
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    await updater.checkForUpdates();
    await updater.install();
    expect(updater.getState()).toEqual({ status: "error", message: "Try again.", manual: true, stage: "install" });
    expect(found.close).toHaveBeenCalled();
  });

  it("releases pending resources and stops notifying removed listeners", async () => {
    const found = pkg();
    const updater = createUpdater({ check: () => Promise.resolve(found) });
    const listener = vi.fn();
    const unsubscribe = updater.subscribe(listener);
    unsubscribe();
    await updater.checkForUpdates();
    expect(listener).not.toHaveBeenCalled();
    await updater.dispose();
    expect(found.close).toHaveBeenCalledTimes(1);
  });
});
