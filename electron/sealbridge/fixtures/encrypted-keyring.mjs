import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function fixtureKeyring(dataDir, observe = () => {}) {
  return { Entry: class {
    constructor(_service, account, options) {
      if (options.linux.store !== "secret-service") throw new Error();
      this.file = path.join(dataDir, account + ".fixture-ciphertext");
    }
    getPassword() {
      let bytes;
      try { bytes = readFileSync(this.file); }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
      const decipher = createDecipheriv("aes-256-gcm", Buffer.alloc(32, 7), bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const value = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString();
      observe(value);
      return value;
    }
    setPassword(value) {
      observe(value);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", Buffer.alloc(32, 7), iv);
      const body = Buffer.concat([cipher.update(value), cipher.final()]);
      writeFileSync(this.file, Buffer.concat([iv, cipher.getAuthTag(), body]), { mode: 0o600, flag: "wx" });
    }
  } };
}
