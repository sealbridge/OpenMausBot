export class SealbridgeError extends Error {
  constructor(code) {
    super(code);
    this.name = "SealbridgeError";
    this.code = code;
  }
}

export const notSupported = operation => ({
  ok: false,
  error: { code: "SEALBRIDGE_NOT_SUPPORTED", operation, message: `Not supported by this ${product.shortName} version` },
});
import { product } from "./product.mjs";

