import assert from "node:assert/strict";
import test from "node:test";
import { product, validateProduct } from "./product.mjs";

test("product configuration is validated, copied and frozen", () => {
  assert.ok(Object.isFrozen(product));
  assert.equal(product.cliVersion, "0.2.2");
  const source = { ...product };
  const copy = validateProduct(source);
  source.shortName = "changed";
  assert.equal(copy.shortName, product.shortName);
  for (const change of [{ appId: "plain" }, { dataDirName: "../escape" }, { cliVersion: "latest" },
    { urlScheme: "Bad:" }, { defaultRelay: "http://localhost" }, { defaultRelay: "https://user:pass@example.test" },
    { defaultRelay: "https://example.test/#fragment" }, { productName: "" }, { extra: "field" }]) {
    assert.throws(() => validateProduct({ ...product, ...change }));
  }
  assert.throws(() => validateProduct(null));
});
