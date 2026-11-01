import { lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./verify-linux-package.mjs", import.meta.url), "utf8");
const check = runInNewContext(
  `(${source.match(/function requireUpdatesDisabled\([^]*?\n\}/)[0]})`,
  { path, lstatSync, fail: (message) => { throw new Error(message); } },
);

describe("Linux package disabled updates", () => {
  it("accepts an isolated resources directory without update metadata", () => {
    const resources = mkdtempSync(path.join(tmpdir(), "sealbridge-update-check-"));
    try {
      expect(() => check(resources, "fixture")).not.toThrow();
    } finally {
      rmSync(resources, { recursive: true, force: true });
    }
  });

  it.each(["upstream", "other-feed", "directory", ...(process.platform === "win32" ? [] : ["dangling-symlink"])])("rejects unexpected metadata: %s", (kind) => {
    const resources = mkdtempSync(path.join(tmpdir(), "sealbridge-update-check-"));
    const updateFile = path.join(resources, "app-update.yml");
    try {
      if (kind === "directory") mkdirSync(updateFile);
      else if (kind === "dangling-symlink") symlinkSync("missing.yml", updateFile);
      else writeFileSync(updateFile, kind === "upstream"
        ? "provider: github\nowner: milind-soni\nrepo: OpenMausBot\n"
        : "provider: generic\nurl: https://example.invalid/updates\n");
      expect(() => check(resources, "fixture")).toThrow("fixture updates are disabled; unexpected app-update.yml");
    } finally {
      rmSync(resources, { recursive: true, force: true });
    }
  });
});
