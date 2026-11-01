import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";
import { parse } from "yaml";
import { product, validateProduct } from "./product.mjs";

test("product configuration is validated, copied and frozen", () => {
  assert.ok(Object.isFrozen(product));
  assert.equal(product.cliVersion, "0.2.2");
  const source = { ...product };
  const copy = validateProduct(source);
  source.shortName = "changed";
  assert.equal(copy.shortName, product.shortName);
  for (const change of [{ appId: "plain" }, { packageName: "Bad Name" }, { desktopName: "../app.desktop" },
    { executableName: "../escape" }, { dataDirName: "../escape" }, { cliVersion: "latest" },
    { urlScheme: "Bad:" }, { defaultRelay: "http://localhost" }, { defaultRelay: "https://user:pass@example.test" },
    { defaultRelay: "https://example.test/#fragment" }, { productName: "" }, { extra: "field" }]) {
    assert.throws(() => validateProduct({ ...product, ...change }));
  }
  assert.throws(() => validateProduct(null));
});

test("package and builder identity match branding/product.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const builder = parse(readFileSync(new URL("../../electron-builder.yml", import.meta.url), "utf8"));
  assert.equal(pkg.name, product.packageName, "package.json name");
  assert.equal(pkg.productName, product.productName, "package.json productName");
  assert.equal(pkg.desktopName, product.desktopName, "package.json desktopName");
  assert.ok(builder.files.includes("branding/product.json"), "packaged product configuration");
  assert.equal(builder.nsis.shortcutName, "${productName}", "NSIS shortcut follows builder productName");
  assert.equal(builder.linux.syncDesktopName, true);
  assert.equal(builder.appId, product.appId, "electron-builder.yml appId");
  assert.equal(builder.productName, product.productName, "electron-builder.yml productName");
  assert.equal(builder.linux.executableName, product.executableName, "electron-builder.yml linux.executableName");
  assert.equal(builder.linux.desktop.entry.Name, product.productName, "electron-builder.yml linux.desktop.entry.Name");
});

test("literal Linux install and removal paths match the product configuration", () => {
  const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const install = read("build/linux-after-install.sh");
  const remove = read("build/linux-after-remove.sh");
  const policy = read("build/linux-openmausbot-browser.apparmor");
  const appRoot = `/opt/${product.productName}`;
  const executable = `${appRoot}/${product.executableName}`;
  assert.ok(install.includes(`APP_ROOT="${appRoot}"`));
  assert.ok(remove.includes(`update-alternatives --remove ${product.executableName} "${executable}"`));
  assert.ok(remove.includes(`[ -L /usr/bin/${product.executableName} ]`));
  assert.ok(remove.includes(`[ "$(readlink /usr/bin/${product.executableName})" = "${executable}" ]`));
  assert.ok(remove.includes(`rm -- /usr/bin/${product.executableName}`));
  assert.ok(policy.includes(`profile openmausbot-browser "${appRoot}/resources/browser-engine/chrome/chrome-headless-shell-linux64/chrome-headless-shell" flags=(unconfined)`));
  for (const hook of [install, remove]) {
    assert.ok(hook.includes("OPENMAUSBOT_POSTINSTALL_TEST_ROOT"));
    assert.ok(hook.includes("$APPARMOR_DIR/openmausbot-browser"));
    for (const [, message] of hook.matchAll(/echo "([^"\n]+)"/g)) {
      assert.ok(message.startsWith(product.productName), `installer message: ${message}`);
    }
  }
  const builder = parse(read("electron-builder.yml"));
  assert.ok(builder.linux.extraResources.some(resource => resource.from === "build/linux-openmausbot-browser.apparmor" && resource.to === "openmausbot-browser.apparmor"));
  assert.ok(install.includes("$APP_ROOT/resources/openmausbot-browser.apparmor"));
});

test("builder desktop entry and main use the same launcher identity", async () => {
  const require = createRequire(import.meta.url);
  const builderRequire = createRequire(require.resolve("electron-builder"));
  assert.equal(require("../cua-linux-runtime.cjs").HOST_BUNDLE_ID, product.appId, "embedded Linux host appId");
  const { LinuxTargetHelper } = builderRequire("app-builder-lib/out/targets/LinuxTargetHelper.js");
  const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const config = parse(read("electron-builder.yml"));
  const helper = new LinuxTargetHelper({
    config,
    info: { metadata: JSON.parse(read("package.json")) },
    appInfo: { productName: product.productName, sanitizedProductName: product.productName },
    platformSpecificBuildOptions: config.linux,
    executableName: config.linux.executableName,
    fileAssociations: [],
  });
  assert.equal(`${helper.getDesktopFileName()}.desktop`, product.desktopName);
  const desktop = await helper.computeDesktopEntry(config.linux);
  for (const line of [`Name=${product.productName}`, `Exec="/opt/${product.productName}/${product.executableName}" %U`,
    `Icon=${product.executableName}`, `StartupWMClass=${product.desktopName.replace(/\.desktop$/, "")}`]) {
    assert.ok(desktop.split("\n").includes(line), line);
  }
  const main = read("electron/main.mjs");
  assert.ok(main.includes('import { product } from "./sealbridge/product.mjs";'));
  const call = main.match(/app\.setDesktopName\([^;]+;/)?.[0];
  assert.ok(call);
  const names = [];
  vm.runInNewContext(call, { app: { setDesktopName: name => names.push(name) }, product });
  assert.deepEqual(names, [product.desktopName]);
});
