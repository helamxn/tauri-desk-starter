// Lecturas comunes de los archivos del proyecto para los scripts y sus tests (node --test).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Raíz del proyecto (la carpeta de package.json). */
export const root = fileURLToPath(new URL("../../", import.meta.url));

export const read = (path: string) => readFileSync(join(root, path), "utf8");
/** JSON de un archivo del proyecto; quien lo llama dice su forma (as …). */
export const readJson = (path: string): unknown => JSON.parse(read(path));

export interface PackageJson {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Versiones de cada paquete en un Cargo.lock: nombre → versiones (puede haber varias). */
export function cargoPackages(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const block of text.split("[[package]]").slice(1)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (name && version) map.set(name, [...(map.get(name) ?? []), version]);
  }
  return map;
}

/** «2.12.5» → «2.12». */
export const versionMinor = (version: string) => version.split(".").slice(0, 2).join(".");

/**
 * Huella de una carpeta de skill: SHA-256 de la lista ordenada «ruta relativa (con /) + SHA-256 del contenido», con
 * los finales de línea normalizados a LF (git en Windows puede convertirlos a CRLF al sacar los archivos).
 */
export function directoryHash(directory: string): string {
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) visit(path);
      else if (e.isFile()) files.push(path);
    }
  };
  visit(directory);
  const lines = files
    .map((path) => {
      const contents = readFileSync(path).toString("utf8").replace(/\r\n/g, "\n");
      const hash = createHash("sha256").update(contents).digest("hex");
      return `${relative(directory, path).split(sep).join("/")}\n${hash}`;
    })
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export interface SkillsLock {
  version: 1;
  skills: Record<string, { source: string; sourceType: string; skillPath: string; computedHash: string }>;
}
