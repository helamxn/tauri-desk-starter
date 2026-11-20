// Lógica pura del release (sin E/S), para probarla con node:test (scripts/release.test.ts). La usa scripts/release.ts.

/** Un error que se muestra tal cual en el workflow: dice qué falta y cómo arreglarlo. */
export class ReleaseError extends Error {}

const DATED_HEADING = /^## \[[^\]]+\] - \d{4}-\d{2}-\d{2}$/;
const SUBHEADING = /^###\s+(.+?)\s*#*\s*$/;
// Lo que termina la sección: la versión siguiente o las definiciones de enlaces del final.
const SECTION_END = /^(## |\[[^\]]+\]:\s)/;

export interface ReleaseNotes {
  /** Para el cuerpo de la release en GitHub. */
  markdown: string;
  /** Texto plano para latest.json: la app lo muestra tal cual en «Update from X to Y». */
  text: string;
}

/**
 * Las notas de `version` en CHANGELOG.md (Keep a Changelog): la sección `## [<version>] - AAAA-MM-DD`, sin comentarios
 * HTML ni subapartados vacíos. Falla si la sección no existe, se repite, no tiene fecha o queda vacía.
 */
export function releaseNotes(changelog: string, version: string): ReleaseNotes {
  const heading = `## [${version}]`;
  const lines = changelog.replace(/\r\n?/g, "\n").split("\n");
  const starts = lines.flatMap((line, i) =>
    line.trimEnd() === heading || line.startsWith(`${heading} `) ? [i] : [],
  );
  const [start] = starts;
  if (start === undefined) {
    throw new ReleaseError(
      `CHANGELOG.md has no section for ${version}. Add "${heading} - YYYY-MM-DD" with its changes (see docs/release.md).`,
    );
  }
  if (starts.length > 1) throw new ReleaseError(`CHANGELOG.md has more than one "${heading}" section. Keep one.`);
  const line = lines[start] ?? "";
  if (!DATED_HEADING.test(line.trimEnd())) {
    throw new ReleaseError(
      `The CHANGELOG.md heading for ${version} must be "${heading} - YYYY-MM-DD", not "${line.trim()}".`,
    );
  }
  const after = lines.findIndex((l, i) => i > start && SECTION_END.test(l));
  const body = lines
    .slice(start + 1, after === -1 ? undefined : after)
    .join("\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n");

  // Bloques: lo que va antes del primer ### (sin título) y cada ### con lo que tiene debajo.
  const blocks: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
  for (const l of body) {
    const subheading = SUBHEADING.exec(l);
    if (subheading) blocks.push({ title: subheading[1] ?? "", lines: [] });
    else blocks.at(-1)?.lines.push(l.trimEnd());
  }
  const nonempty = blocks
    .map((b) => ({ title: b.title, contents: trimBlankLines(b.lines) }))
    .filter((b) => b.contents.length > 0);
  if (nonempty.length === 0) {
    throw new ReleaseError(
      `The CHANGELOG.md section for ${version} is empty. List what changes for users under "${heading}".`,
    );
  }

  const markdown = nonempty
    .map((b) => [...(b.title ? [`### ${b.title}`, ""] : []), ...b.contents].join("\n"))
    .join("\n\n");
  const text = nonempty
    .map((b) => [...(b.title ? [plainText(b.title)] : []), ...b.contents.map(plainLine)].join("\n"))
    .join("\n\n");
  return { markdown, text };
}

function trimBlankLines(lines: string[]): string[] {
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first === -1) return [];
  const last = lines.findLastIndex((l) => l.trim() !== "");
  return lines.slice(first, last + 1);
}

/** Una línea de markdown como texto: viñetas con «-», sin enlaces, énfasis ni código. */
function plainLine(line: string): string {
  return plainText(line.replace(/^(\s*)[*+](\s+)/, "$1-$2"));
}

function plainText(value: string): string {
  return value
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1");
}

/** Lo que pone tauri.conf.json en `version`: la ruta a package.json, que tiene la versión de la app. */
export const VERSION_FROM_PACKAGE = "../package.json";

/**
 * La versión de la app: la de package.json (MAJOR.MINOR.PATCH), que Tauri lee porque tauri.conf.json apunta a ella.
 * Cargo.toml tiene la suya, pero Tauri no la usa.
 */
export function appVersion(tauriVersion: unknown, packageVersion: unknown): string {
  if (tauriVersion !== VERSION_FROM_PACKAGE) {
    throw new ReleaseError(`tauri.conf.json must read the version from package.json ("version": "${VERSION_FROM_PACKAGE}").`);
  }
  if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
    throw new ReleaseError(`The version in package.json must be MAJOR.MINOR.PATCH, not ${String(packageVersion)}`);
  }
  return packageVersion;
}

export interface UpdaterConfig {
  identifier: string;
  pubkey: string;
  endpoints: string[];
}

/**
 * Lo que impide publicar: marcadores en `pubkey`, `endpoints` o `identifier`, o un `endpoints` que no apunta al
 * repositorio de releases (si no, la versión publicada no se podría actualizar nunca). Devuelve los problemas.
 */
export function releaseBlockers(conf: UpdaterConfig, repository: string): string[] {
  const problems: string[] = [];
  if (conf.identifier.startsWith("com.example.")) problems.push(`identifier is still a placeholder (${conf.identifier})`);
  // La CLI envuelve en base64 dos líneas de minisign. La segunda contiene Ed, el ID y la clave pública.
  const decoded = Buffer.from(conf.pubkey.trim(), "base64");
  const keyLine = /^untrusted comment: [^\r\n]+\r?\n([A-Za-z0-9+/]{56})\s*$/.exec(decoded.toString("utf8"))?.[1];
  if (decoded.toString("base64") !== conf.pubkey.trim() || !keyLine || Buffer.from(keyLine, "base64").toString("ascii", 0, 2) !== "Ed") {
    problems.push("plugins.updater.pubkey is not a key from `pnpm tauri signer generate` (see docs/release.md)");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || repository.startsWith("example/")) {
    problems.push(`GITHUB_REPOSITORY is not set to the releases repository (${repository || "empty"})`);
    return problems;
  }
  const expected = `https://github.com/${repository}/releases/latest/download/latest.json`;
  if (conf.endpoints.length !== 1 || conf.endpoints[0] !== expected) {
    problems.push(`plugins.updater.endpoints must be exactly ["${expected}"]`);
  }
  return problems;
}

/** La versión exacta de un paquete en pnpm-lock.yaml (sección importers, proyecto raíz). */
export function lockedVersion(lock: string, pkg: string): string | null {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // El lock puede llegar con CRLF (git en Windows): se normaliza antes de buscar.
  const m = new RegExp(`^\\s+'?${escaped}'?:\\n\\s+specifier: [^\\n]+\\n\\s+version: (\\d+\\.\\d+\\.\\d+)`, "m").exec(
    lock.replace(/\r\n?/g, "\n"),
  );
  return m?.[1] ?? null;
}
