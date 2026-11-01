import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createIdentityStore } from "./identity-store.mjs";
import { product } from "./product.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), `${product.dataDirName}-identity-`));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "identity.enc");
  let record;
  let created = 0;
  const safeStorage = { isAsyncEncryptionAvailable: async () => true, getSelectedStorageBackend: () => "gnome_libsecret",
    async encryptStringAsync(text) { record = text; return { result: Buffer.from("fixture-ciphertext") }; },
    async decryptStringAsync() { return { result: record }; },
  };
  const provider = { async create() { created++; return { did: "did:example:owner", publicKey: "public", privateKey: "fixture-only" }; }, async restore(value) { return value; } };
  return { file, safeStorage, provider, created: () => created };
}

test("identity store exposes only public fields, persists ciphertext, and reuses identity", async t => {
  const options = await fixture(t);
  const store = createIdentityStore(options);
  assert.equal(await store.getPublicInfo(), null);
  const [first, second] = await Promise.all([store.ensureIdentity(), store.ensureIdentity()]);
  assert.deepEqual(first, { did: "did:example:owner", publicKey: "public" });
  assert.deepEqual(second, first);
  assert.equal(options.created(), 1);
  assert.equal(await readFile(options.file, "utf8"), "fixture-ciphertext");
  assert.deepEqual(await createIdentityStore(options).ensureIdentity(), first);
  assert.equal(options.created(), 1);
});

for (const mode of ["unavailable", "basic_text", "unknown-backend", "locked"]) {
  test(`identity store refuses ${mode} without creating a replacement`, async t => {
    const options = await fixture(t);
    if (mode === "unavailable") options.safeStorage.isAsyncEncryptionAvailable = async () => false;
    if (mode === "basic_text") options.safeStorage.getSelectedStorageBackend = () => "basic_text";
    if (mode === "unknown-backend") delete options.safeStorage.getSelectedStorageBackend;
    if (mode === "locked") {
      await writeFile(options.file, "ciphertext");
      options.safeStorage.decryptStringAsync = async () => { throw new Error("fixture-only"); };
    }
    const store = createIdentityStore({ ...options, platform: "linux" });
    await assert.rejects(store.ensureIdentity(), { code: "SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE" });
    assert.equal(options.created(), 0);
  });
}

test("identity creation without a core provider stays unsupported", async t => {
  const options = await fixture(t);
  await assert.rejects(createIdentityStore({ ...options, provider: undefined }).ensureIdentity(), { code: "SEALBRIDGE_NOT_SUPPORTED" });
});
