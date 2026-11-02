import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { product } from "../product.mjs";

export async function fixtureRuntime(t) {
  const runtimeDir = await mkdtemp(path.join(tmpdir(), "sealbridge-runtime-fixture-"));
  t.after(() => rm(runtimeDir, { recursive: true, force: true }));
  const packageDir = path.join(runtimeDir, "node_modules", product.cliPackage);
  await mkdir(packageDir, { recursive: true });
  await writeFile(path.join(packageDir, "package.json"), JSON.stringify({
    name: product.cliPackage, version: product.cliVersion, bin: { [product.cliPackage]: "cli.js" },
  }));
  await writeFile(path.join(packageDir, "cli.js"), "");
  return runtimeDir;
}
