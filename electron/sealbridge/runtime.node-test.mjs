import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveRuntime } from "./runtime.mjs";
import { product } from "./product.mjs";

test("runtime resolves development and packaged paths and verifies the pinned version", async t => {
  const root = await mkdtemp(path.join(tmpdir(), `${product.dataDirName}-runtime space-`));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeDir = path.join(root, "sealbridge-runtime");
  const packageDir = path.join(runtimeDir, "node_modules", product.cliPackage);
  await mkdir(packageDir, { recursive: true });
  const manifest = { name: product.cliPackage, version: product.cliVersion, bin: { [product.cliPackage]: "cli.js" } };
  const save = () => writeFile(path.join(packageDir, "package.json"), JSON.stringify(manifest));
  await save();
  await writeFile(path.join(packageDir, "cli.js"), "");
  assert.equal(resolveRuntime({ runtimeDir }).cliEntry, path.join(packageDir, "cli.js"));
  assert.equal(resolveRuntime({ resourcesPath: root }).cliEntry, path.join(packageDir, "cli.js"));
  manifest.version = "99.0.0";
  await save();
  assert.throws(() => resolveRuntime({ runtimeDir }), { code: "SEALBRIDGE_RUNTIME_VERSION_MISMATCH" });
  manifest.version = product.cliVersion;
  manifest.bin[product.cliPackage] = "../escape.js";
  await save();
  assert.throws(() => resolveRuntime({ runtimeDir }), { code: "SEALBRIDGE_RUNTIME_INVALID" });
});
