import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url));
const json = file => JSON.parse(read(file));

test("Bundled core archives, runtime lock and preparation share the reviewed pin", () => {
  const pin = json("vendor/sealbridge/provenance.json");
  assert.equal(pin.commit, "83dc05658308a5b5c41e44f9df1f7bd48c2c768f");
  assert.equal(pin.version, "0.5.0");
  assert.equal(pin.sourceSha256, "db710e530f3bb9d8fa3ca3a4c0782aecc5e76dc7b7abafda65770b11567b3f31");
  assert.equal(pin.packageSha256, "2e46242584ad998f255b998ee8a4313e44d47b6d0d803b6f624fe441743fc263");
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
