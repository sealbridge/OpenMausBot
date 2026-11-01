import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { readSecureCredentials } from "../secure-credentials.mjs";
import { SealbridgeError } from "./errors.mjs";
import { containsSecret } from "./redaction.mjs";

function publicIdentity(value) {
  if (!value || typeof value.did !== "string" || !value.did.startsWith("did:") ||
      typeof value.publicKey !== "string" || containsSecret(value.did)) {
    throw new SealbridgeError("SEALBRIDGE_IDENTITY_INVALID");
  }
  return Object.freeze({ did: value.did, publicKey: value.publicKey });
}

/** Main-only identity store: getPublicInfo()/ensureIdentity() return only DID and public key.
 * The injected core provider owns create()/restore(record); records and secret material stay in main.
 * Storage receives only safeStorage ciphertext. Missing/locked OS storage never falls back to plaintext.
 */
export function createIdentityStore({ safeStorage, file, provider, platform = process.platform } = {}) {
  let active;
  let ensuring;
  const available = async () => {
    if (!safeStorage) return false;
    const supported = safeStorage.isAsyncEncryptionAvailable
      ? await safeStorage.isAsyncEncryptionAvailable() : safeStorage.isEncryptionAvailable();
    return supported && (platform !== "linux" ||
      (typeof safeStorage.getSelectedStorageBackend === "function" && safeStorage.getSelectedStorageBackend() !== "basic_text"));
  };
  async function load() {
    if (!(await available())) throw new SealbridgeError("SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE");
    let ciphertext;
    try { ciphertext = await readFile(file); }
    catch (error) {
      if (error.code === "ENOENT") return null;
      throw new SealbridgeError("SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE");
    }
    const result = await readSecureCredentials({
      exists: () => true, isAvailable: available, readFile: () => ciphertext,
      decrypt: value => safeStorage.decryptStringAsync ? safeStorage.decryptStringAsync(value) : safeStorage.decryptString(value),
      sleep: () => Promise.resolve(), delays: [],
    });
    if (result.status !== "ok") throw new SealbridgeError("SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE");
    if (!provider?.restore) throw new SealbridgeError("SEALBRIDGE_NOT_SUPPORTED");
    return publicIdentity(await provider.restore(result.credentials));
  }
  async function ensure() {
    active ??= await load();
    if (active) return active;
    if (!provider?.create) throw new SealbridgeError("SEALBRIDGE_NOT_SUPPORTED");
    const record = await provider.create();
    const info = publicIdentity(record);
    if (!(await available())) throw new SealbridgeError("SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE");
    try {
      const encrypted = safeStorage.encryptStringAsync
        ? await safeStorage.encryptStringAsync(JSON.stringify(record)) : safeStorage.encryptString(JSON.stringify(record));
      const ciphertext = Buffer.isBuffer(encrypted) ? encrypted : encrypted?.result;
      if (!Buffer.isBuffer(ciphertext)) throw new Error();
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, ciphertext, { mode: 0o600, flag: "wx" });
      active = info;
      return active;
    } catch { throw new SealbridgeError("SEALBRIDGE_IDENTITY_STORAGE_UNAVAILABLE"); }
  }
  return Object.freeze({
    async getPublicInfo() { active ??= await load(); return active; },
    ensureIdentity() {
      ensuring ??= ensure().finally(() => { ensuring = undefined; });
      return ensuring;
    },
  });
}
