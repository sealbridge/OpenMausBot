import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url));
const json = file => JSON.parse(read(file));

test("Bundled core archives, runtime lock and preparation share the reviewed pin", () => {
  const pin = json("vendor/sealbridge/provenance.json");
  assert.equal(pin.commit, "7e306e5c9b336632c33ea4ba9fd60a000ec9aa94");
  assert.equal(pin.version, "0.5.0");
  assert.equal(pin.sourceSha256, "47efebd51a740df45a97905fe9b49219da08e92475e85b1e59949a9bb5dd9cdb");
  assert.equal(pin.packageSha256, "90565f4475fde09a1054993e318e24da27c07265db7c7779cb7d36b6e9f19a21");
  for (const [name, hash] of [["source.tar.gz", pin.sourceSha256], ["sealbridge-0.5.0.tgz", pin.packageSha256]])
    assert.equal(createHash("sha256").update(read(`vendor/sealbridge/${name}`)).digest("hex"), hash);
  const file = "file:../../vendor/sealbridge/sealbridge-0.5.0.tgz";
  assert.equal(json("runtime/sealbridge/package.json").dependencies.sealbridge, file);
  const lock = json("runtime/sealbridge/package-lock.json").packages["node_modules/sealbridge"];
  assert.equal(lock.version, pin.version); assert.equal(lock.resolved, file);
  assert.equal(lock.integrity, "sha512-" + createHash("sha512").update(read("vendor/sealbridge/sealbridge-0.5.0.tgz")).digest("base64"));
  assert.ok(read("electron-builder.yml").toString().includes("  - shared/context-pooling-copy.json"));
  const prepare = read("scripts/prepare-sealbridge-runtime.mjs").toString();
  assert.ok(prepare.indexOf('throw new Error("Core archive integrity mismatch")') < prepare.indexOf('"ci"'));
  assert.ok(prepare.includes('"sealbridge-0.5.0.tgz", provenance.packageSha256'));
});
