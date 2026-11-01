import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "electron-builder";
import { product } from "../electron/sealbridge/product.mjs";

const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve("electron-builder"));
const { LinuxPackager } = builderRequire("app-builder-lib/out/linuxPackager.js");

export function linuxPackagerFactory(info, platform) {
  if (platform.nodeName !== "linux") throw new Error("Linux packaging requires the Linux platform");
  const packager = new LinuxPackager(info);
  // electron-builder 26.15.3 uses sanitizedProductName for FPM install paths,
  // launcher templates and AppArmor, independently of linux.executableName.
  // https://github.com/electron/electron/issues/44414
  packager.appInfo.sanitizedProductName = product.executableName;
  return packager;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build({
    linux: process.argv.slice(2),
    x64: true,
    publish: "never",
    platformPackagerFactory: linuxPackagerFactory,
  });
}
