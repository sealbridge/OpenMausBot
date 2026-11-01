import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { product } from "./product.mjs";
import { SealbridgeError } from "./errors.mjs";

export const developmentRuntimeDir = fileURLToPath(new URL("../../build/sealbridge-runtime/", import.meta.url));

export function resolveRuntime({ resourcesPath, runtimeDir = developmentRuntimeDir, nodeBinary = process.execPath } = {}) {
  const root = resourcesPath ? path.join(resourcesPath, "sealbridge-runtime") : runtimeDir;
  const packageDir = path.resolve(root, "node_modules", product.cliPackage);
  const manifest = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
  if (manifest.version !== product.cliVersion || manifest.name !== product.cliPackage) {
    throw new SealbridgeError("SEALBRIDGE_RUNTIME_VERSION_MISMATCH");
  }
  const entry = path.resolve(packageDir, manifest.bin?.[product.cliPackage] ?? "");
  if (!entry.startsWith(packageDir + path.sep) || !entry.endsWith(".js") || !existsSync(entry) || !path.isAbsolute(nodeBinary) || /\.(?:cmd|bat)$/i.test(nodeBinary)) {
    throw new SealbridgeError("SEALBRIDGE_RUNTIME_INVALID");
  }
  return Object.freeze({ cliEntry: entry, nodeBinary });
}
