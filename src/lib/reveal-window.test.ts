import { getCurrentWindow } from "@tauri-apps/api/window";
import { logError } from "./log";
import { revealWindow } from "./reveal-window";

vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("./log", () => ({ logError: vi.fn() }));

function mockShow(result: Promise<void>) {
  const show = vi.fn(() => result);
  vi.mocked(getCurrentWindow).mockReturnValue({ show } as unknown as ReturnType<typeof getCurrentWindow>);
  return show;
}

describe("revealWindow", () => {
  it("shows the desktop window", () => {
    const show = mockShow(Promise.resolve());
    revealWindow(true);
    expect(show).toHaveBeenCalledOnce();
  });

  it("does nothing in the browser", () => {
    const show = mockShow(Promise.resolve());
    revealWindow(false);
    expect(show).not.toHaveBeenCalled();
  });

  it("logs a fixed message if the window can't be shown", async () => {
    mockShow(Promise.reject(new Error("denied")));
    revealWindow(true);
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith("No se pudo mostrar la ventana");
    });
  });
});
