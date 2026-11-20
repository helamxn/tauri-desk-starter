import { removeKey, createStoredValue, writeText, readText, migrate, type Migration } from "./storage";

function withoutStorage() {
  const fails = () => {
    throw new DOMException("no disponible", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(fails);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(fails);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(fails);
}

describe("storage operations", () => {
  it("reads, writes and removes saved data", () => {
    expect(writeText("a:v1", "x")).toBe(true);
    expect(readText("a:v1")).toBe("x");
    removeKey("a:v1");
    expect(readText("a:v1")).toBeNull();
  });

  it("handles unavailable storage", () => {
    withoutStorage();
    expect(readText("a:v1")).toBeNull();
    expect(writeText("a:v1", "x")).toBe(false);
    expect(() => {
      removeKey("a:v1");
    }).not.toThrow();
  });
});

describe("createStoredValue", () => {
  const create = () => createStoredValue("n:v1", (text) => Number(text ?? "0"), String);

  it("reads lazily on first access", () => {
    const value = create();
    localStorage.setItem("n:v1", "7");
    expect(value.get()).toBe(7);
  });

  it("saves and notifies current subscribers", () => {
    const value = create();
    const listener = vi.fn();
    const unsubscribe = value.subscribe(listener);
    value.save(3);
    expect(localStorage.getItem("n:v1")).toBe("3");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    value.save(4);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("retains changes in memory when storage fails", () => {
    withoutStorage();
    const value = create();
    expect(value.get()).toBe(0);
    value.save(5);
    expect(value.get()).toBe(5);
  });
});

describe("storage migrations", () => {
  // Ejemplo: en :v2, «auto» pasa a llamarse «autoUpdate».
  const v1ToV2: Migration = {
    from: "ejemplo:v1",
    to: "ejemplo:v2",
    convert: (text) => {
      try {
        const { auto } = JSON.parse(text) as { auto?: unknown };
        return typeof auto === "boolean" ? JSON.stringify({ autoUpdate: auto }) : null;
      } catch {
        return null;
      }
    },
  };

  it("writes v2 before removing v1", () => {
    localStorage.setItem("ejemplo:v1", JSON.stringify({ auto: false }));
    migrate([v1ToV2]);
    expect(localStorage.getItem("ejemplo:v2")).toBe(JSON.stringify({ autoUpdate: false }));
    expect(localStorage.getItem("ejemplo:v1")).toBeNull();
  });

  it("ignores a missing source", () => {
    migrate([v1ToV2]);
    expect(localStorage.length).toBe(0);
  });

  it("preserves existing v2 and removes v1", () => {
    localStorage.setItem("ejemplo:v1", JSON.stringify({ auto: false }));
    localStorage.setItem("ejemplo:v2", JSON.stringify({ autoUpdate: true }));
    migrate([v1ToV2]);
    expect(localStorage.getItem("ejemplo:v2")).toBe(JSON.stringify({ autoUpdate: true }));
    expect(localStorage.getItem("ejemplo:v1")).toBeNull();
  });

  it("drops invalid data and uses defaults", () => {
    localStorage.setItem("ejemplo:v1", "{roto");
    migrate([v1ToV2]);
    expect(localStorage.getItem("ejemplo:v2")).toBeNull();
    expect(localStorage.getItem("ejemplo:v1")).toBeNull();
  });

  it("keeps v1 if writing v2 fails", () => {
    localStorage.setItem("ejemplo:v1", JSON.stringify({ auto: false }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("lleno", "QuotaExceededError");
    });
    migrate([v1ToV2]);
    expect(localStorage.getItem("ejemplo:v1")).toBe(JSON.stringify({ auto: false }));
  });

  it("leaves future versions untouched", () => {
    // La app con :v1 no conoce :v3: no hay migración que la nombre, así que sigue ahí.
    localStorage.setItem("ejemplo:v3", "{}");
    migrate([]);
    expect(localStorage.getItem("ejemplo:v3")).toBe("{}");
  });
});
