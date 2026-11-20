import { act, render, waitFor } from "@testing-library/react";
import { savePreferences, getPreferences, DEFAULT_PREFERENCES } from "./preferences";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: unknown) => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke }));
const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("./log", () => ({ logError }));

import { useKeepRunning } from "./keep-running";

function Probe({ inTauri = true }: { inTauri?: boolean }) {
  useKeepRunning(inTauri);
  return null;
}

beforeEach(() => {
  savePreferences(DEFAULT_PREFERENCES);
  localStorage.clear();
  invoke.mockReset();
  invoke.mockImplementation(() => Promise.resolve());
});

describe("useKeepRunning", () => {
  it("applies Keep running initially and on change", () => {
    render(<Probe />);
    expect(invoke).toHaveBeenLastCalledWith("set_keep_running", { enabled: false });

    act(() => {
      savePreferences({ keepRunning: true });
    });
    expect(invoke).toHaveBeenLastCalledWith("set_keep_running", { enabled: true });

    act(() => {
      savePreferences({ keepRunning: false });
    });
    expect(invoke).toHaveBeenLastCalledWith("set_keep_running", { enabled: false });
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("ignores unrelated preference changes", () => {
    render(<Probe />);
    act(() => {
      savePreferences({ autoUpdate: false });
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("restores the disabled preference if Rust rejects the change", async () => {
    invoke.mockImplementation((_command, args) =>
      (args as { enabled: boolean }).enabled
        ? Promise.reject(new Error("Couldn't add the app to the system tray."))
        : Promise.resolve(),
    );
    render(<Probe />);
    act(() => {
      savePreferences({ keepRunning: true });
    });
    await waitFor(() => {
      expect(getPreferences().keepRunning).toBe(false);
    });
    expect(logError).toHaveBeenCalledWith("No se pudo aplicar Keep running");
    expect(invoke).toHaveBeenLastCalledWith("set_keep_running", { enabled: false });
  });

  it("skips native calls in the browser", () => {
    render(<Probe inTauri={false} />);
    expect(invoke).not.toHaveBeenCalled();
  });
});
