import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { read, readJson, root } from "./project.ts";

const markers = /My App|my-app|my_app|com\.example\.myapp/;
const guide = "docs/renombrar.md";
const referenceFiles = new Set([guide, "scripts/lib/identity.ts", ".agents/skills/shadcn/SKILL.md"]);

export function remainingIdentity(release = false): string[] {
  const documented = new Set([...read(guide).matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]));
  const template = (readJson("src-tauri/tauri.conf.json") as { identifier: string }).identifier === "com.example.myapp"
    && (readJson("package.json") as { name: string }).name === "my-app";
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  return files.split("\0").filter((file) => {
    if (!file || referenceFiles.has(file) || !existsSync(join(root, file))) return false;
    if (!release && template && documented.has(file)) return false;
    const contents = read(file);
    return !contents.includes("\0") && markers.test(contents);
  }).map((file) => `Template identity remains in ${file}`);
}
