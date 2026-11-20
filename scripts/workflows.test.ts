// Reglas de los workflows (pnpm test:scripts), leyendo el texto (sin parser de YAML): acciones fijadas a un commit,
// checkouts sin credenciales, permisos mínimos y la clave de firma solo en el job `sign`.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { read, readJson, root } from "./lib/project.ts";

const directory = ".github/workflows";
const workflows = readdirSync(join(root, directory)).filter((a) => a.endsWith(".yml"));
const text = (file: string) => read(`${directory}/${file}`).replace(/\r\n?/g, "\n");

/** Los jobs de un workflow: nombre → su bloque de texto. */
function jobs(contents: string): Map<string, string> {
  const after = contents.split(/^jobs:\n/m)[1] ?? "";
  const map = new Map<string, string>();
  for (const block of after.split(/^(?= {2}[a-z][\w-]*:\n)/m)) {
    const name = /^ {2}([a-z][\w-]*):\n/.exec(block)?.[1];
    if (name) map.set(name, block);
  }
  return map;
}

describe("workflows", () => {
  for (const file of workflows) {
    const contents = text(file);

    it(`${file}: pins every action by commit and records its version`, () => {
      const uses = [...contents.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm)].map((m) => (m[1] ?? "").trim());
      assert.ok(uses.length > 0);
      // Los workflows del propio repositorio (./.github/workflows/…) van con el mismo commit.
      for (const useEntry of uses.filter((u) => !u.startsWith("./.github/workflows/"))) {
        assert.match(useEntry, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/, useEntry);
      }
    });

    it(`${file}: disables checkout credential persistence`, () => {
      const checkouts = contents.split(/uses: actions\/checkout@/).slice(1);
      for (const rest of checkouts) assert.match(rest.split("\n").slice(1, 3).join("\n"), /persist-credentials: false/);
    });

    it(`${file}: uses the project Node version`, () => {
      assert.doesNotMatch(contents, /node-version:\s*["']?\d/);
    });
  }

  it("runs three read-only CI jobs on main, pull requests and releases", () => {
    const ci = text("ci.yml");
    assert.match(ci, /^permissions:\n {2}contents: read\n/m);
    assert.match(ci, /^on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:\n {2}workflow_call:\n/m);
    assert.deepEqual([...jobs(ci).keys()], ["frontend", "rust", "e2e"]);
    assert.match(ci, /pnpm audit --audit-level high\n/, "audit de todo el árbol (sin --prod)");
    assert.match(jobs(ci).get("rust") ?? "", /runs-on: windows-latest/);
  });

  it("builds the real app on every push to main", () => {
    const rust = jobs(text("ci.yml")).get("rust") ?? "";
    assert.match(
      rust,
      /if: github\.event_name == 'push'\n\s+run: pnpm tauri build --ci --bundles nsis --config src-tauri\/tauri\.local\.conf\.json/,
    );
  });

  it("lints the release-only Rust code on every run, also in pull requests", () => {
    // webview.rs solo compila su configuración de WebView2 en release: el clippy de debug no la ve.
    const rust = jobs(text("ci.yml")).get("rust") ?? "";
    const step = /^ {6}- run: cargo clippy --manifest-path src-tauri\/Cargo\.toml --locked --release -- -D warnings$/m;
    assert.match(rust, step);
    // Sin `if:` (iría en la línea siguiente): un paso condicionado al push dejaría fuera los PR.
    const lines = rust.split("\n");
    const index = lines.findIndex((line) => step.test(line));
    assert.doesNotMatch(lines[index + 1] ?? "", /^ {8}if:/);
  });

  it("serializes manual releases without default permissions", () => {
    const release = text("release.yml");
    assert.match(release, /^on:\n {2}workflow_dispatch:\n/m);
    assert.match(release, /^permissions: \{\}\n/m);
    assert.match(release, /cancel-in-progress: false/);
    assert.deepEqual([...jobs(release).keys()], ["check", "ci", "build", "sign", "publish"]);
  });

  it("builds what it publishes after the full CI, without caches", () => {
    const j = jobs(text("release.yml"));
    assert.match(j.get("ci") ?? "", /uses: \.\/\.github\/workflows\/ci\.yml/);
    const build = j.get("build") ?? "";
    assert.match(build, /needs: \[check, ci\]/);
    assert.doesNotMatch(build, /cache: pnpm|rust-cache/);
  });

  it("limits signing secrets to the signing job", () => {
    for (const [name, block] of jobs(text("release.yml"))) {
      assert.equal(block.includes("TAURI_SIGNING_PRIVATE_KEY"), name === "sign", `clave de firma en ${name}`);
      assert.equal(block.includes("RELEASES_TOKEN"), false, `RELEASES_TOKEN en ${name}`);
    }
  });

  it("isolates signing and publishing from source checkout", () => {
    const j = jobs(text("release.yml"));
    for (const name of ["sign", "publish"]) assert.doesNotMatch(j.get(name) ?? "", /actions\/checkout/, name);
    assert.match(j.get("build") ?? "", /--config src-tauri\/tauri\.local\.conf\.json/);
    assert.match(j.get("sign") ?? "", /permissions: \{\}/);
    assert.match(j.get("publish") ?? "", /permissions:\n +contents: write/);
  });

  it("binds the installer signature to the version required by the updater", () => {
    const config = readJson("src-tauri/tauri.conf.json") as { plugins: { updater: { requireSignedVersion: boolean } } };
    assert.equal(config.plugins.updater.requireSignedVersion, true);
    assert.ok(jobs(text("release.yml")).get("sign")?.includes('signer sign --app-version "$VERSION"'));
  });

  it("publishes the verified commit to its own repository", () => {
    const publish = jobs(text("release.yml")).get("publish") ?? "";
    assert.match(publish, /GH_TOKEN: \x24\{\{ github.token \}\}/);
    assert.ok(publish.includes('--repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA"'));
    assert.ok(publish.includes('if [ "$owned" != true ]'));
  });
});

// Dependabot: GitHub rechaza dos entradas del mismo ecosistema y carpeta, y las dos mitades de Tauri (npm y Cargo)
// tienen que subir en el mismo PR.
describe("dependabot", () => {
  const contents = read(".github/dependabot.yml").replace(/\r\n?/g, "\n");
  const entries = contents
    .split(/^ {2}- package-ecosystem: /m)
    .slice(1)
    .map((block) => ({
      ecosystem: block.split("\n")[0]?.trim() ?? "",
      directory: /^ {4}directory: (\S+)$/m.exec(block)?.[1] ?? "",
      group: /^ {4}multi-ecosystem-group: (\S+)$/m.exec(block)?.[1],
      patterns: /^ {4}patterns: (.+)$/m.exec(block)?.[1],
    }));

  it("has one entry per ecosystem and directory", () => {
    const keys = entries.map((e) => `${e.ecosystem} ${e.directory}`);
    assert.deepEqual(keys.sort(), ["cargo /src-tauri", "github-actions /", "npm /", "rust-toolchain /"]);
  });

  it("updates every npm and Cargo dependency in one shared group", () => {
    const npm = entries.find((e) => e.ecosystem === "npm");
    const cargo = entries.find((e) => e.ecosystem === "cargo");
    assert.ok(npm?.group);
    assert.equal(cargo?.group, npm.group);
    assert.equal(npm.patterns, '["*"]');
    assert.equal(cargo.patterns, '["*"]');
  });
});
