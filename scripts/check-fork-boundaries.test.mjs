import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertArtifactBoundary, checkArtifactDirectory, checkSourceFiles } from "./check-fork-boundaries.mjs";

let root;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
function fixture(entries) {
  root = mkdtempSync(join(tmpdir(), "fork-boundary-"));
  for (const [file, content] of Object.entries(entries)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return Object.keys(entries);
}

describe("fork source boundary", () => {
  it.each([
    ["enterprise/server/index.ts", ""], ["CLA.md", ""],
    ...["contributors", "npm-package", "docker", "connector-release", "sync-published-release", "prepare-release", "docs"].map(name => [`.github/workflows/${name}.yml`, ""]),
    ["server/loader.ts", 'await import("../enterprise/server/index.js")'],
    ["docs/sealbridge/loader.ts", 'await import("../../enterprise/server/index.js")'],
    ["server/loader.ts", 'export { x } from "../enterprise/server/index.ts"'],
    ["server/loader.ts", 'const enterpriseLayerDirs = [];'],
    ["server/loader.ts", 'process.env.OMB_ENTERPRISE_DIR'],
    ["scripts/bundle-server.mjs", 'copy("enterprise")'],
    ["Dockerfile", "COPY enterprise /app/enterprise"],
    [".github/workflows/release.yml", "repo: milind-soni/OpenMausBot"],
    [".github/workflows/release.yml", "owner: milind-soni"],
    [".github/workflows/release.yml", "gh release upload --repo milind-soni/openmausbot-releases"],
    [".github/workflows/package-win.yml", "gh release upload --repo milind-soni/OpenMausBot"],
    [".github/workflows/release.yml", "repo: SupaMaus/OpenMausBot"],
    [".github/workflows/release.yml", "token: ${{ secrets.RELEASE_PAT }}"],
    [".github/workflows/release.yml", "token: ${{ secrets.RELEASES_PAT }}"],
    [".github/workflows/release.yml", "token: ${{ secrets['PERSONAL_ACCESS_TOKEN'] }}"],
  ])("rejects %s: %s", (file, content) => {
    const files = fixture({ [file]: content });
    expect(checkSourceFiles(root, files).length).toBeGreaterThan(0);
  });

  it("allows explicit historical records, the notice setting and ordinary artifact workflows", () => {
    const files = fixture({
      "LICENSING.md": "enterprise/ was removed", "CHANGELOG.md": "enterprise/",
      "docs/sealbridge/upstream-sync.md": "git rm -r enterprise",
      "server/edition.ts": 'const settings = ["OMB_ENTERPRISE_DIR"];',
      ".github/workflows/package-linux.yml": "token: ${{ secrets.GITHUB_TOKEN }}",
      ".github/workflows/package-win.yml": 'echo "app-update.yml does not point at milind-soni/OpenMausBot"',
    });
    expect(checkSourceFiles(root, files)).toEqual([]);
  });

  it("still rejects a loader added to the notice module", () => {
    const files = fixture({ "server/edition.ts": 'const settings = ["OMB_ENTERPRISE_DIR"]; await import("../enterprise/server/index.js");' });
    expect(checkSourceFiles(root, files)).toEqual([expect.stringContaining("loader")]);
  });

  it("rejects additional layer configuration access in the notice module", () => {
    const files = fixture({ "server/edition.ts": 'const settings = ["OMB_ENTERPRISE_DIR"]; const directory = process.env.OMB_ENTERPRISE_DIR;' });
    expect(checkSourceFiles(root, files)).toEqual([expect.stringContaining("configuration")]);
  });
});

describe("unpacked artifact boundary", () => {
  it("accepts OSS resources and rejects missing output", () => {
    fixture({ "index.js": 'console.log("oss");', "licenses/LICENSE.txt": "Apache License" });
    expect(checkArtifactDirectory(root)).toEqual([]);
    expect(() => assertArtifactBoundary(root)).not.toThrow();
    expect(checkArtifactDirectory(join(root, "missing"))).toHaveLength(1);
  });
  it.each([
    ["dist-server/enterprise/server/index.js", ""],
    ["licenses/renamed.txt", "OpenMausBot Enterprise License"],
    ["notices/renamed.md", "OpenMausBot Enterprise License"],
    ["notices/renamed", "OpenMausBot Enterprise License"],
    ["index.js", "function enterpriseLayerDirs() {}"],
  ])("rejects stale or renamed artifacts: %s", (file, content) => {
    fixture({ [file]: content });
    expect(checkArtifactDirectory(root).length).toBeGreaterThan(0);
    expect(() => assertArtifactBoundary(root)).toThrow();
  });
});
