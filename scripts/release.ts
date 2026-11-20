// Ayudas del workflow de release (.github/workflows/release.yml, docs/release.md):
//
//   node scripts/release.ts version   imprime la versión (la de package.json, que lee tauri.conf.json)
//   node scripts/release.ts notes    imprime las notas de esa versión (su sección de CHANGELOG.md)
//   node scripts/release.ts check     falla si quedan marcadores (pubkey, endpoints, identifier) o GITHUB_REPOSITORY no
//                                     encaja con endpoints
//   node scripts/release.ts tools     imprime, para GITHUB_OUTPUT, la versión de Node y las huellas de la CLI de
//                                     Tauri (el job `sign` firma con ellas sin checkout)
//   node scripts/release.ts prepare   tras `tauri build` sin firma: deja en release/ el instalador, las notas y
//                                     latest.json sin la firma (la añade `sign`)
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { remainingIdentity } from "./lib/identity.ts";
import { read, readJson, root } from "./lib/project.ts";
import {
  ReleaseError,
  appVersion,
  releaseBlockers,
  releaseNotes,
  lockedVersion,
  type ReleaseNotes,
} from "./lib/release.ts";

interface TauriConf {
  identifier: string;
  productName: string;
  version: string;
  plugins: { updater: { pubkey: string; endpoints: string[] } };
}

const conf = () => readJson("src-tauri/tauri.conf.json") as TauriConf;

function version(): string {
  return appVersion(conf().version, (readJson("package.json") as { version: string }).version);
}

function notes(): ReleaseNotes {
  return releaseNotes(read("CHANGELOG.md"), version());
}

function check(): void {
  const { identifier, plugins } = conf();
  const problems = releaseBlockers(
    { identifier, pubkey: plugins.updater.pubkey, endpoints: plugins.updater.endpoints },
    process.env.GITHUB_REPOSITORY ?? "",
  );
  problems.push(...remainingIdentity(true));
  if (problems.length > 0) throw new ReleaseError(`Not ready to publish:\n- ${problems.join("\n- ")}`);
}

function signingTools(): string {
  const node = read(".node-version").trim();
  const lock = read("pnpm-lock.yaml").replaceAll("\r\n", "\n");
  const cli = lockedVersion(lock, "@tauri-apps/cli");
  if (!cli) throw new ReleaseError("Couldn't read the locked @tauri-apps/cli version.");
  const integrity = (name: string) => {
    const entry = lock.split(`  '@tauri-apps/${name}@${cli}':\n`)[1];
    const digest = /^ {4}resolution: \{integrity: sha512-([A-Za-z0-9+/]{86}==)\}/.exec(entry ?? "")?.[1];
    if (!digest) throw new ReleaseError("Missing SHA-512 for " + name);
    return digest;
  };
  return [`node=${node}`, `tauri-cli=${cli}`, `cli-integrity=${integrity("cli")}`, `native-integrity=${integrity("cli-linux-x64-gnu")}`].join("\n");
}

function prepare(): void {
  const v = version();
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const { markdown, text } = notes();
  // El nombre que da Tauri al instalador NSIS: productName_versión_arquitectura-setup.exe.
  const file = `${conf().productName}_${v}_x64-setup.exe`;
  const installer = join(root, "src-tauri/target/release/bundle/nsis", file);
  if (!existsSync(installer)) throw new ReleaseError(`Missing ${file}: build with --bundles nsis first.`);

  // GitHub puede normalizar espacios y caracteres del nombre visible al subir un asset.
  const asset = `windows-x64-${v}-setup.exe`;
  const output = join(root, "release");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(join(output, "assets"), { recursive: true });
  copyFileSync(installer, join(output, "assets", asset));
  const latest = {
    version: v,
    notes: text,
    pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    platforms: {
      "windows-x86_64": {
        // La pone el job `sign` (contenido del .sig).
        signature: "",
        url: `https://github.com/${repository}/releases/download/v${v}/${asset}`,
      },
    },
  };
  writeFileSync(join(output, "latest.unsigned.json"), `${JSON.stringify(latest, null, 2)}\n`);
  writeFileSync(join(output, "notes.md"), `${markdown}\n`);
  writeFileSync(join(output, "installer.txt"), `${asset}\n`);
  console.log(`release/assets/${asset}\nrelease/latest.unsigned.json\nrelease/notes.md`);
}

try {
  switch (process.argv[2]) {
    case "version":
      console.log(version());
      break;
    case "notes":
      console.log(notes().markdown);
      break;
    case "check":
      check();
      console.log("Ready to publish.");
      break;
    case "tools":
      console.log(signingTools());
      break;
    case "prepare":
      prepare();
      break;
    default:
      throw new ReleaseError("Usage: node scripts/release.ts version|notes|check|tools|prepare");
  }
} catch (error) {
  if (!(error instanceof ReleaseError)) throw error;
  console.error(error.message);
  process.exit(1);
}
