import { PREFERENCES_KEY, parsePreferences, DEFAULT_PREFERENCES } from "./preferences";

// El módulo guarda el valor leído: cada test usa uno nuevo.
async function newPreferences() {
  vi.resetModules();
  return import("./preferences");
}

describe("preferences", () => {
  it("uses a versioned key", () => {
    expect(PREFERENCES_KEY).toBe("preferences:v1");
  });

  it("enables updates and disables the tray by default", () => {
    expect(DEFAULT_PREFERENCES).toEqual({ autoUpdate: true, keepRunning: false });
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("falls back only for invalid values", () => {
    expect(parsePreferences(JSON.stringify({ autoUpdate: "sí", keepRunning: true }))).toEqual({
      autoUpdate: true,
      keepRunning: true,
    });
  });

  it("drops unknown keys", () => {
    expect(parsePreferences(JSON.stringify({ keepRunning: true, token: "x" }))).toEqual({
      autoUpdate: true,
      keepRunning: true,
    });
  });

  it.each(["{roto", "null", "42", '"texto"', "[]"])("falls back to defaults for invalid object %s", (text) => {
    expect(parsePreferences(text)).toEqual(DEFAULT_PREFERENCES);
  });

  it("merges changes into the persisted preferences", async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ autoUpdate: false }));
    const { savePreferences, getPreferences } = await newPreferences();
    savePreferences({ keepRunning: true });
    expect(getPreferences()).toEqual({ autoUpdate: false, keepRunning: true });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "")).toEqual({ autoUpdate: false, keepRunning: true });
  });

  it("keeps session preferences when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("no disponible", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("no disponible", "SecurityError");
    });
    const { savePreferences, getPreferences } = await newPreferences();
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
    savePreferences({ autoUpdate: false });
    expect(getPreferences().autoUpdate).toBe(false);
  });
});
