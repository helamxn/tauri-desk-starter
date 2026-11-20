import { act, render } from "@testing-library/react";
import { THEME_KEY, parseTheme } from "@/lib/theme";

const html = document.documentElement;

/** Un matchMedia que se puede cambiar desde el test (el sistema pasa a oscuro o a claro). */
function system(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_kind: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_kind: string, listener: () => void) => listeners.delete(listener),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);
  return {
    change(next: boolean) {
      query.matches = next;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
  };
}

// El tema guardado se lee una vez por módulo: cada test carga uno nuevo.
async function mount() {
  vi.resetModules();
  const { ThemeProvider } = await import("./theme-provider");
  const theme = await import("@/lib/theme");
  render(
    <ThemeProvider>
      <p>contenido</p>
    </ThemeProvider>,
  );
  return theme;
}

afterEach(() => {
  html.className = "";
  html.style.colorScheme = "";
});

describe("ThemeProvider", () => {
  it("uses a versioned key and falls back to System for unknown values", () => {
    expect(THEME_KEY).toBe("theme:v1");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme(null)).toBe("system");
  });

  it("applies the stored theme before paint", async () => {
    system(false);
    localStorage.setItem(THEME_KEY, "dark");
    await mount();
    expect(html).toHaveClass("dark");
    expect(html).not.toHaveClass("light");
    expect(html.style.colorScheme).toBe("dark");
  });

  it("tracks system theme changes while open", async () => {
    const control = system(false);
    await mount();
    expect(html).toHaveClass("light");
    control.change(true);
    expect(html).toHaveClass("dark");
    expect(html.style.colorScheme).toBe("dark");
  });

  it("respects explicit Light and Dark choices", async () => {
    const control = system(true);
    localStorage.setItem(THEME_KEY, "light");
    await mount();
    control.change(false);
    control.change(true);
    expect(html).toHaveClass("light");
  });

  it("applies and stores a theme change", async () => {
    system(false);
    const { setThemeChoice } = await mount();
    act(() => {
      setThemeChoice("dark");
    });
    expect(html).toHaveClass("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("defaults to System without storage", async () => {
    system(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("no disponible", "SecurityError");
    });
    await mount();
    expect(html).toHaveClass("dark");
  });
});

describe("native window theme", () => {
  it("applies Light and Dark to the window and clears the override for System", async () => {
    const setTheme = vi.fn(() => Promise.resolve());
    vi.doMock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTheme }) }));
    vi.resetModules();
    const { applyWindowTheme } = await import("@/lib/theme");
    await applyWindowTheme("dark", true);
    await applyWindowTheme("light", true);
    await applyWindowTheme("system", true);
    expect(setTheme.mock.calls).toEqual([["dark"], ["light"], [null]]);
    vi.doUnmock("@tauri-apps/api/window");
  });

  it("skips the native window in the browser", async () => {
    const setTheme = vi.fn(() => Promise.resolve());
    vi.doMock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setTheme }) }));
    vi.resetModules();
    const { applyWindowTheme } = await import("@/lib/theme");
    await applyWindowTheme("dark", false);
    expect(setTheme).not.toHaveBeenCalled();
    vi.doUnmock("@tauri-apps/api/window");
  });
});
