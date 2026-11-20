// Tests de coherencia del proyecto (pnpm test:scripts): versión única, mitades de Tauri y lock de skills.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  directoryHash,
  read,
  readJson,
  versionMinor,
  cargoPackages,
  root,
  type PackageJson,
  type SkillsLock,
} from "./lib/project.ts";
import { appVersion, lockedVersion } from "./lib/release.ts";

const pkg = (readJson("package.json") as PackageJson);
const conf = (readJson("src-tauri/tauri.conf.json") as { version: string });
const cargoToml = read("src-tauri/Cargo.toml");
const cargoLock = cargoPackages(read("src-tauri/Cargo.lock"));

describe("application version", () => {
  it("lives only in package.json, which Tauri reads", () => {
    assert.equal(appVersion(conf.version, pkg.version), pkg.version);
  });
});

// La CLI de Tauri ya se niega a compilar con las mitades desalineadas, pero en los PR la CI no la ejecuta (solo en los
// push a main): sin este test, un PR de Dependabot a medias solo fallaría después de fusionarlo. Compara las versiones
// instaladas (los dos locks), no los rangos de package.json.
describe("Tauri compatibility", () => {
  const npm = { ...pkg.dependencies, ...pkg.devDependencies };
  const pnpmLock = read("pnpm-lock.yaml");
  const singleVersion = (crate: string) => {
    const vs = cargoLock.get(crate) ?? [];
    assert.equal(vs.length, 1, `${crate}: se esperaba una sola versión en Cargo.lock, hay ${String(vs.length)}`);
    return vs[0] ?? "";
  };
  const npmMinor = (name: string) => {
    const version = lockedVersion(pnpmLock, name);
    assert.ok(version, `${name} no está en pnpm-lock.yaml`);
    return versionMinor(version);
  };
  const tauriMinor = versionMinor(singleVersion("tauri"));

  it("matches the CLI and API minor to the Rust crate", () => {
    for (const p of ["@tauri-apps/api", "@tauri-apps/cli"]) {
      assert.equal(npmMinor(p), tauriMinor, `${p} frente a tauri ${tauriMinor}`);
    }
  });

  it("keeps plugin minors aligned across npm and Cargo", () => {
    const plugins = Object.keys(npm).filter((p) => p.startsWith("@tauri-apps/plugin-"));
    for (const p of plugins) {
      const crate = `tauri-plugin-${p.slice("@tauri-apps/plugin-".length)}`;
      assert.equal(npmMinor(p), versionMinor(singleVersion(crate)), `${p} frente a ${crate}`);
    }
    // Y al revés: ningún plugin de Cargo sin su mitad de npm (salvo los que solo existen en Rust).
    const rustOnly = new Set(["tauri-plugin-single-instance", "tauri-plugin-window-state"]);
    const declared = [...cargoToml.matchAll(/^(tauri-plugin-[a-z-]+)\s*=/gm)].map((m) => m[1] ?? "");
    for (const crate of declared.filter((c) => !rustOnly.has(c))) {
      assert.ok(plugins.includes(`@tauri-apps/plugin-${crate.slice("tauri-plugin-".length)}`), `${crate} sin su paquete npm`);
    }
  });
});

describe("skills", () => {
  const lock = (readJson("skills-lock.json") as SkillsLock);
  const directory = join(root, ".agents", "skills");
  const inDirectory = readdirSync(directory, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

  it("uses the expected lock format", () => {
    assert.equal(lock.version, 1);
    for (const [name, s] of Object.entries(lock.skills)) {
      for (const field of ["source", "sourceType", "skillPath", "computedHash"] as const) {
        assert.ok(s[field], `${name}: falta ${field}`);
      }
    }
  });

  it("matches the installed skill set", () => {
    assert.deepEqual(Object.keys(lock.skills).sort(), inDirectory);
  });

  it("matches each installed skill digest", () => {
    for (const name of inDirectory) {
      assert.equal(lock.skills[name]?.computedHash, directoryHash(join(directory, name)), name);
    }
  });
});
