import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyMaximizeEvent, MAXIMIZE_EVENT, maximizeButtonArea, mountWindowControls } from "./window-controls";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve()) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("./log", () => ({ logError: vi.fn() }));

type Handler = (event: { payload: unknown }) => void;

function mockWindow({ maximized = false } = {}) {
  const handlers = new Map<string, Handler>();
  let onResized: (() => void) | undefined;
  const unlisten = vi.fn();
  const appWindow = {
    minimize: vi.fn(() => Promise.resolve()),
    toggleMaximize: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    isMaximized: vi.fn(() => Promise.resolve(maximized)),
    onResized: vi.fn((handler: () => void) => {
      onResized = handler;
      return Promise.resolve(unlisten);
    }),
    listen: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
      return Promise.resolve(unlisten);
    }),
  };
  vi.mocked(getCurrentWindow).mockReturnValue(appWindow as unknown as ReturnType<typeof getCurrentWindow>);
  return { appWindow, handlers, unlisten, resized: () => onResized?.() };
}

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const unmount = mountWindowControls(container);
  const button = (name: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  return { container, unmount, button };
}

describe("mountWindowControls", () => {
  it("adds the three window buttons, out of the Tab order, in a labelled group", () => {
    mockWindow();
    const { container, button } = mount();
    expect(container.querySelector('[role="group"]')).toHaveAttribute("aria-label", "Window controls");
    for (const name of ["Minimize", "Maximize", "Close"]) expect(button(name)).toHaveAttribute("tabindex", "-1");
  });

  it("runs each window action", () => {
    const { appWindow } = mockWindow();
    const { button } = mount();
    button("Minimize")?.click();
    button("Maximize")?.click();
    button("Close")?.click();
    expect(appWindow.minimize).toHaveBeenCalled();
    expect(appWindow.toggleMaximize).toHaveBeenCalled();
    expect(appWindow.close).toHaveBeenCalled();
  });

  it("shows Restore when the window is maximized and follows its changes", async () => {
    const { appWindow, resized } = mockWindow({ maximized: true });
    const { button } = mount();
    await flush();
    expect(button("Restore")).not.toBeNull();

    appWindow.isMaximized.mockResolvedValue(false);
    resized();
    await flush();
    expect(button("Maximize")).not.toBeNull();
  });

  it("sends the maximize button area to Rust once, and an empty one when removed", async () => {
    mockWindow();
    const { unmount } = mount();
    await flush();
    window.dispatchEvent(new Event("resize"));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("set_maximize_button_area", { top: 0, right: 0, width: 0, height: 0 });

    unmount();
    // La misma zona (vacía en jsdom) no se vuelve a enviar.
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("paints the hover and press that the native window reports", async () => {
    const { handlers } = mockWindow();
    const { button } = mount();
    await flush();
    const maximize = button("Maximize");
    handlers.get(MAXIMIZE_EVENT)?.({ payload: "enter" });
    expect(maximize).toHaveAttribute("data-hover");
    handlers.get(MAXIMIZE_EVENT)?.({ payload: "press" });
    expect(maximize).toHaveAttribute("data-pressed");
    handlers.get(MAXIMIZE_EVENT)?.({ payload: "leave" });
    expect(maximize).not.toHaveAttribute("data-hover");
    expect(maximize).not.toHaveAttribute("data-pressed");
  });

  it("removes the buttons and stops listening", async () => {
    const { unlisten } = mockWindow();
    const { container, unmount } = mount();
    await flush();
    unmount();
    await flush();
    expect(container).toBeEmptyDOMElement();
    expect(unlisten).toHaveBeenCalledTimes(2);
  });
});

describe("maximizeButtonArea", () => {
  it("measures from the top right corner of the window", () => {
    const button = document.createElement("button");
    button.getBoundingClientRect = () => ({ top: 0, right: 1234, width: 46, height: 36 }) as DOMRect;
    expect(maximizeButtonArea(button, 1280)).toEqual({ top: 0, right: 46, width: 46, height: 36 });
  });
});

describe("applyMaximizeEvent", () => {
  it("ignores anything that is not a known event", () => {
    const button = document.createElement("button");
    applyMaximizeEvent(button, { evil: true });
    applyMaximizeEvent(button, "click");
    expect(button.attributes).toHaveLength(0);
  });
});
