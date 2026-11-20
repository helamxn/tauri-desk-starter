// Notas del release, versión única, marcadores pendientes y versiones exactas (pnpm test:scripts).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { root } from "./lib/project.ts";
import { ReleaseError, appVersion, releaseBlockers, releaseNotes, lockedVersion } from "./lib/release.ts";

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-12-01

<!-- Para quien usa la app, en inglés. -->

### Added

- **Theme** follows the system. See [docs](https://example.com).
* Faster \`startup\`.

### Fixed

## [0.1.0] - 2026-11-19

- First version.

[0.2.0]: https://example.com/v0.2.0
`;

describe("releaseNotes", () => {
  it("extracts only the requested release and skips comments and empty subsections", () => {
    const { markdown, text } = releaseNotes(CHANGELOG, "0.2.0");
    assert.equal(
      markdown,
      "### Added\n\n- **Theme** follows the system. See [docs](https://example.com).\n* Faster `startup`.",
    );
    assert.equal(text, "Added\n- Theme follows the system. See docs.\n- Faster startup.");
  });

  it("stops the final release at link definitions", () => {
    assert.equal(releaseNotes(CHANGELOG, "0.1.0").markdown, "- First version.");
  });

  it("accepts CRLF", () => {
    assert.equal(releaseNotes(CHANGELOG.replaceAll("\n", "\r\n"), "0.1.0").markdown, "- First version.");
  });

  for (const [scenario, changelog, version, message] of [
    ["missing section", CHANGELOG, "9.9.9", /no section for 9\.9\.9/],
    ["duplicate", `${CHANGELOG}\n## [0.1.0] - 2026-11-20\n- x\n`, "0.1.0", /more than one/],
    ["missing date", "## [0.3.0]\n- x\n", "0.3.0", /must be "## \[0\.3\.0\] - YYYY-MM-DD"/],
    ["empty", "## [0.3.0] - 2026-12-01\n<!-- nada -->\n### Added\n", "0.3.0", /is empty/],
  ] as const) {
    it(`reports an invalid changelog: ${scenario}`, () => {
      assert.throws(() => releaseNotes(changelog, version), (e: unknown) => e instanceof ReleaseError && message.test(e.message));
    });
  }
});

describe("appVersion", () => {
  it("returns the package.json version when Tauri reads it from there", () => {
    assert.equal(appVersion("../package.json", "1.2.3"), "1.2.3");
  });
  it("rejects a version written in tauri.conf.json or an unsupported one", () => {
    assert.throws(() => appVersion("1.2.3", "1.2.3"), /must read the version from package\.json/);
    assert.throws(() => appVersion("../package.json", "1.2.3-beta"), /MAJOR\.MINOR\.PATCH/);
  });
});

describe("releaseBlockers", () => {
  const ready = {
    identifier: "org.acme.reader",
    pubkey: Buffer.from("untrusted comment: test key\n" + Buffer.concat([Buffer.from("Ed"), Buffer.alloc(40)]).toString("base64")).toString("base64"),
    endpoints: ["https://github.com/acme/reader/releases/latest/download/latest.json"],
  };

  it("accepts a configured release repository", () => {
    assert.deepEqual(releaseBlockers(ready, "acme/reader"), []);
  });

  it("rejects a public key with only a minisign comment", () => {
    const pubkey = Buffer.from("untrusted comment: missing public key\n").toString("base64");
    assert.ok(releaseBlockers({ ...ready, pubkey }, "acme/reader").some((problem) => problem.includes("pubkey")));
  });

  it("reports template settings and mismatched endpoints", () => {
    const problems = releaseBlockers(
      {
        identifier: "com.example.placeholder",
        pubkey: "REEMPLAZAR",
        endpoints: ["https://github.com/example/placeholder/releases/latest/download/latest.json"],
      },
      "example/placeholder",
    );
    assert.equal(problems.length, 3, problems.join("\n"));
    assert.equal(releaseBlockers(ready, "acme/other").length, 1);
  });

});

describe("signing tools", () => {
  it("reads exact dependency versions from LF and CRLF locks", () => {
    const lock = "importers:\n  .:\n    devDependencies:\n      '@tauri-apps/cli':\n        specifier: ^2.12.5\n        version: 2.12.5\n";
    assert.equal(lockedVersion(lock, "@tauri-apps/cli"), "2.12.5");
    assert.equal(lockedVersion(lock.replaceAll("\n", "\r\n"), "@tauri-apps/cli"), "2.12.5");
    assert.equal(lockedVersion(lock, "@tauri-apps/api"), null);
  });

  it("reports the Node version and both signing tool digests", () => {
    const output = execFileSync(process.execPath, ["scripts/release.ts", "tools"], { cwd: root, encoding: "utf8" });
    assert.match(output, /^node=\d+\.\d+\.\d+\ntauri-cli=\d+\.\d+\.\d+\ncli-integrity=[A-Za-z0-9+/]{86}==\nnative-integrity=[A-Za-z0-9+/]{86}==\n$/);
  });

  it("rejects a release with placeholders", () => {
    assert.throws(() =>
      execFileSync(process.execPath, ["scripts/release.ts", "check"], {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, GITHUB_REPOSITORY: "example/placeholder" },
      }),
    );
  });
});
