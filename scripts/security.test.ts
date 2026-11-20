// Seguridad de la configuración (pnpm test:scripts): reglas que la CSP, la capability y los comandos tienen que cumplir
// siempre, y que cada directiva y cada permiso estén justificados en docs/arquitectura.md. Añadir un permiso es
// añadirlo a la capability y a su tabla; el test no guarda otra copia de la lista.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { read, readJson, root } from "./lib/project.ts";

interface Capability {
  identifier: string;
  remote?: unknown;
  webviews?: string[];
  platforms?: string[];
  windows: string[];
  permissions: (string | { identifier: string })[];
}

interface WindowConfig {
  zoomHotkeysEnabled?: boolean;
  generalAutofillEnabled?: boolean;
}

const conf = readJson("src-tauri/tauri.conf.json") as {
  app: { windows: WindowConfig[]; security: { csp: string; devCsp?: unknown } };
};
const capability = readJson("src-tauri/capabilities/default.json") as Capability;
const granted = capability.permissions.map((p) => (typeof p === "string" ? p : p.identifier));
const manifestCommands = [...read("src-tauri/build.rs").matchAll(/"([a-z_]+)"/g)].map((m) => m[1] ?? "");
const architecture = read("docs/arquitectura.md").replace(/\r\n?/g, "\n");

/** La primera columna (entre comillas invertidas) de la tabla de una sección de docs/arquitectura.md. */
function documented(heading: string): string[] {
  const section = architecture.split(`\n## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1] ?? "");
}

/** La CSP como directiva → fuentes. */
const csp = new Map(
  conf.app.security.csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map(([name, ...sources]) => [name ?? "", sources] as const),
);

describe("CSP", () => {
  it("allows only the app's own origin, Tauri's IPC and embedded data", () => {
    const allowed = new Set(["'self'", "'none'", "data:", "blob:", "ipc:", "http://ipc.localhost"]);
    for (const [directive, sources] of csp) {
      for (const source of sources) {
        const inlineStyles = directive === "style-src" && source === "'unsafe-inline'";
        assert.ok(allowed.has(source) || inlineStyles, `${directive} ${source}`);
      }
    }
  });

  it("keeps the hardening directives", () => {
    assert.deepEqual(csp.get("default-src"), ["'self'"]);
    for (const directive of ["object-src", "form-action", "frame-ancestors"]) {
      assert.deepEqual(csp.get(directive), ["'none'"], directive);
    }
    assert.deepEqual(csp.get("base-uri"), ["'self'"]);
  });

  it("documents every directive with its exact sources", () => {
    const current = [...csp].map(([name, sources]) => [name, ...sources].join(" "));
    assert.deepEqual(documented("Política de contenido").sort(), current.sort());
  });

  it("defines no development policy", () => {
    // En escritorio, `tauri dev` carga el servidor de Vite y Tauri no le aplica ninguna CSP: una devCsp no se
    // aplicaría y daría a entender lo contrario. La CSP se prueba en el e2e, sobre `vite preview` (e2e/csp.spec.ts).
    assert.equal(conf.app.security.devCsp, undefined);
  });
});

describe("webview", () => {
  it("keeps browser zoom disabled (Tauri's default)", () => {
    for (const window of conf.app.windows) assert.notEqual(window.zoomHotkeysEnabled, true);
  });

  it("does not save form data in WebView2 (autofill is on by default)", () => {
    for (const window of conf.app.windows) assert.equal(window.generalAutofillEnabled, false);
  });
});

describe("capabilities", () => {
  it("has a single capability, for the main window, without remote or extra webview scopes", () => {
    assert.deepEqual(readdirSync(join(root, "src-tauri/capabilities")), ["default.json"]);
    assert.equal(capability.identifier, "default");
    assert.deepEqual(capability.windows, ["main"]);
    assert.equal(capability.remote, undefined);
    assert.equal(capability.webviews, undefined);
    assert.equal(capability.platforms, undefined);
  });

  it("grants single permissions, never sets or broad core scopes", () => {
    for (const forbidden of [/:default$/, /\*/, /^core:(app|path|webview|tray|menu|image):/, /^(opener|shell|fs|http|clipboard)/]) {
      assert.deepEqual(
        granted.filter((p) => forbidden.test(p)),
        [],
        String(forbidden),
      );
    }
    assert.equal(new Set(granted).size, granted.length, "sin permisos repetidos");
  });

  it("documents every granted permission and nothing else", () => {
    assert.deepEqual(documented("Permisos de la ventana principal").sort(), [...granted].sort());
  });
});

describe("application commands", () => {
  const commands = granted.filter((p) => p.startsWith("allow-"));
  const declared = manifestCommands.map((c) => `allow-${c.replaceAll("_", "-")}`);

  it("declares commands in the application manifest", () => {
    assert.ok(manifestCommands.length > 0);
  });

  it("grants exactly the declared commands", () => {
    assert.deepEqual([...commands].sort(), [...declared].sort());
  });
});
