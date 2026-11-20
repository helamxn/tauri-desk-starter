import { captureGlobalErrors, describeError } from "./error-reporting";
import { logError } from "./log";

vi.mock("./log", () => ({ logError: vi.fn() }));

function errorWithStack(message: string) {
  const error = new RangeError(message);
  error.stack = [
    `RangeError: ${message}`,
    "    at parse (http://tauri.localhost/assets/index.js:1:200)",
    "    at load (http://tauri.localhost/assets/index.js:1:900)",
  ].join("\n");
  return error;
}

describe("describeError", () => {
  it("keeps the type and the code locations, never the message", () => {
    const text = describeError("Error en la interfaz", errorWithStack("correo@ejemplo.com"));
    expect(text).toBe(
      [
        "Error en la interfaz: RangeError",
        "  at parse (http://tauri.localhost/assets/index.js:1:200)",
        "  at load (http://tauri.localhost/assets/index.js:1:900)",
      ].join("\n"),
    );
  });

  it("adds the component stack of render errors", () => {
    const text = describeError("Error en la interfaz", errorWithStack("x"), "\n    at HomePage (index.js:1:1)\n    at Outlet");
    expect(text).toContain("Componentes:\n  at HomePage (index.js:1:1)\n  at Outlet");
  });

  it("names values that are not errors by their type", () => {
    expect(describeError("Promesa rechazada sin capturar", "texto con datos")).toBe(
      "Promesa rechazada sin capturar: string",
    );
  });

  it("limits the stack to a few frames", () => {
    const error = new Error("x");
    error.stack = ["Error: x", ...Array.from({ length: 40 }, (_, i) => `    at f${String(i)} (a.js:1:1)`)].join("\n");
    expect(describeError("c", error).split("\n")).toHaveLength(16);
  });
});

describe("captureGlobalErrors", () => {
  it("logs uncaught exceptions and unhandled rejections until stopped", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Un EventTarget propio: jsdom no informa de estos eventos en su consola.
    const target = new EventTarget();
    const stop = captureGlobalErrors(target as unknown as Window);

    target.dispatchEvent(new ErrorEvent("error", { error: errorWithStack("secreto") }));
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: new TypeError("secreto") });
    target.dispatchEvent(rejection);
    expect(logError).toHaveBeenCalledWith(expect.stringMatching(/^Excepción sin capturar: RangeError/));
    expect(logError).toHaveBeenCalledWith(expect.stringMatching(/^Promesa rechazada sin capturar: TypeError/));
    expect(vi.mocked(logError).mock.calls.join("\n")).not.toContain("secreto");

    stop();
    vi.mocked(logError).mockClear();
    target.dispatchEvent(new ErrorEvent("error", { error: new Error("otra") }));
    expect(logError).not.toHaveBeenCalled();
  });
});
