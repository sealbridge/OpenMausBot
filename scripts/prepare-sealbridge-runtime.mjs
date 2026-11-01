import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { product } from "../electron/sealbridge/product.mjs";
import { developmentRuntimeDir, resolveRuntime } from "../electron/sealbridge/runtime.mjs";

const runtimeDir = developmentRuntimeDir;
await mkdir(runtimeDir, { recursive: true });
await writeFile(path.join(runtimeDir, "package.json"), JSON.stringify({ private: true, dependencies: { [product.cliPackage]: product.cliVersion } }, null, 2) + "\n");
const require = createRequire(import.meta.url);
const candidates = [
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.join(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
  ...(process.env.PATH ?? process.env.Path ?? "").split(path.delimiter).map(directory => path.join(directory, "npm")),
];
let entry;
for (const candidate of candidates) {
  if (!candidate) continue;
  try {
    const resolved = realpathSync(candidate);
    if (!resolved.endsWith("npm-cli.js")) continue;
    entry = require.resolve(resolved);
    break;
  } catch { /* npm layouts vary by Node distribution. */ }
}
if (!entry) throw new Error("Cannot resolve npm CLI JavaScript entry for this Node installation");
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [entry, "install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", "--prefix", runtimeDir], {
    shell: false, windowsHide: true, stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Pinned CLI installation failed")));
});
console.log(resolveRuntime({ runtimeDir }).cliEntry);
