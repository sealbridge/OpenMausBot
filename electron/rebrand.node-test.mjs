import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { product, userDataPath, validateProduct } from "./sealbridge/product.mjs";
import { chatLinkFrom } from "./chat-link.mjs";
import { packageUrlFromDeepLink } from "./package-link.mjs";
import { isCloudDeepLink } from "./cloud-entry.mjs";
import { isOrganizationDeepLink } from "./organization-entry.mjs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");

for (const newline of ["\n", "\r\n"]) {
  test(`desktop profile identity precedes path consumers and the lock (${JSON.stringify(newline)})`, t => {
    const home = mkdtempSync(path.join(tmpdir(), "sealbridge-identity-"));
    t.after(() => rmSync(home, { recursive: true, force: true }));
    const main = read("./main.mjs");
    const initialization = read("./sealbridge/app-identity.mjs").replace(/\r?\n/g, newline).replace(/^import .*;\r?\n/gm, "");
    assert.ok(main.startsWith('import "./sealbridge/app-identity.mjs";'));
    const values = {};
    vm.runInNewContext(initialization, {
      mkdirSync: fs.mkdirSync, userDataPath, product, process: { platform: "win32" },
      app: {
        getPath: key => { assert.equal(key, "appData"); return home; },
        setPath: (key, value) => { assert.ok(fs.statSync(value).isDirectory()); values[key] = value; },
        setName: value => { values.name = value; },
        setAppUserModelId: value => { values.appId = value; },
      },
    });
    assert.deepEqual(values, { name: product.productName, userData: path.join(home, product.dataDirName), appId: product.appId });
    assert.ok(main.indexOf('import "./sealbridge/app-identity.mjs";') < main.indexOf('app.getPath("userData")'));
    assert.ok(main.indexOf('import "./sealbridge/app-identity.mjs";') < main.indexOf("app.requestSingleInstanceLock()"));
    assert.ok(main.includes('path.join(app.getPath("home"), `.${product.dataDirName}`)'));
    assert.ok(!main.includes('".openmausbot"'));
  });
}

test("packaged startup with updates disabled loads no updater and schedules no network checks", () => {
  assert.equal(product.updateChannel, "disabled");
  assert.throws(() => validateProduct({ ...product, updateChannel: "stable" }));
  const source = read("./updater.mjs");
  const start = source.slice(source.indexOf("export function startUpdater")).replace("export ", "");
  const states = [];
  const forbidden = () => assert.fail("disabled updater performed work");
  const context = {
    product, app: { isPackaged: true }, updaterCoordinator: {},
    setState: state => states.push(state.status), require: forbidden, setTimeout: forbidden, setInterval: forbidden,
  };
  vm.runInNewContext(`${source.match(/export const productUpdatesEnabled = .*;/)[0].replace("export ", "")}\n${start}\nstartUpdater();`, context);
  assert.deepEqual(states, ["idle"]);
  assert.equal(context.updaterCoordinator, null);
  assert.match(read("../electron-builder.yml"), /^publish: null$/m);
});

test("desktop entry points accept only the fork's protocol", () => {
  assert.equal(chatLinkFrom(`${product.urlScheme}://bot/fixture`), `${product.urlScheme}://bot/fixture`);
  assert.equal(chatLinkFrom("openmausbot://bot/fixture"), null);
  assert.equal(packageUrlFromDeepLink("openmausbot://install?url=https://github.com/a/b"), null);
  assert.equal(isCloudDeepLink("openmausbot://cloud"), false);
  assert.equal(isOrganizationDeepLink("openmausbot://organization"), false);
  assert.equal(isCloudDeepLink(`${product.urlScheme}://cloud`), true);
  assert.equal(isOrganizationDeepLink(`${product.urlScheme}://organization`), true);
});

test("a fresh server root leaves both upstream data directories untouched", t => {
  const home = mkdtempSync(path.join(tmpdir(), "sealbridge-storage-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  for (const name of [".openmausbot", ".opengrokbot"]) {
    fs.mkdirSync(path.join(home, name));
    fs.writeFileSync(path.join(home, name, "sentinel"), name);
  }
  const source = read("../server/config.ts");
  const declarations = source.slice(source.indexOf("export const DATA_DIR ="), source.indexOf("export function ensureDirs"));
  const ensure = source.slice(source.indexOf("export function ensureDirs"), source.indexOf('let lastIgnoredConfigWarning'));
  vm.runInNewContext(`${declarations}\n${ensure}\nensureDirs();`.replaceAll("export ", ""), {
    product, process: { env: {} }, join: path.join, homedir: () => home,
    mkdirSync: fs.mkdirSync, migrateLegacyFeatureFlags: () => {},
  });
  assert.ok(fs.statSync(path.join(home, `.${product.dataDirName}`, "events")).isDirectory());
  assert.ok(!fs.existsSync(path.join(home, `.${product.dataDirName}`, "sentinel")));
  for (const name of [".openmausbot", ".opengrokbot"]) assert.equal(fs.readFileSync(path.join(home, name, "sentinel"), "utf8"), name);
});
