// Regenera skills-lock.json a partir de .agents/skills/: conserva el origen de cada skill y recalcula su huella.
// Uso: node scripts/skills-lock.ts (después de añadir o actualizar una skill; ver AGENTS.md).
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { directoryHash, readJson, root, type SkillsLock } from "./lib/project.ts";

const directory = join(root, ".agents", "skills");
const lock = (readJson("skills-lock.json") as SkillsLock);
const skills: SkillsLock["skills"] = {};

for (const name of readdirSync(directory, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const previous = lock.skills[name];
  if (!previous) throw new Error(`La skill «${name}» no está en skills-lock.json: añada su origen (source, sourceType, skillPath) a mano primero.`);
  skills[name] = { ...previous, computedHash: directoryHash(join(directory, name)) };
}

writeFileSync(join(root, "skills-lock.json"), `${JSON.stringify({ version: 1, skills } satisfies SkillsLock, null, 2)}\n`);
console.log(`skills-lock.json: ${String(Object.keys(skills).length)} skills.`);
