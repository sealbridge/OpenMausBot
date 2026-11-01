import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
  assert.equal(builder.appId, product.appId, "electron-builder.yml appId");
  assert.equal(builder.productName, product.productName, "electron-builder.yml productName");
  assert.equal(builder.linux.executableName, product.executableName, "electron-builder.yml linux.executableName");
  assert.equal(builder.linux.desktop.entry.Name, product.productName, "electron-builder.yml linux.desktop.entry.Name");
});
