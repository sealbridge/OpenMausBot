import { readFileSync } from "node:fs";

export function validateProduct(value) {
  const fields = ["productName", "shortName", "appId", "urlScheme", "dataDirName", "cliPackage", "cliVersion", "defaultRelay"];
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      fields.some(key => typeof value[key] !== "string" || !value[key].trim() || value[key] !== value[key].trim()) ||
      Object.keys(value).some(key => !fields.includes(key))) {
    throw new TypeError("Invalid product configuration");
  }
  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){2,}$/.test(value.appId) ||
      !/^[a-z][a-z0-9+.-]*$/.test(value.urlScheme) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(value.dataDirName) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(value.cliPackage) ||
      !/^\d+\.\d+\.\d+$/.test(value.cliVersion)) {
    throw new TypeError("Invalid product identifiers");
  }
  const relay = new URL(value.defaultRelay);
  if (relay.protocol !== "https:" || relay.username || relay.password || relay.search || relay.hash) {
    throw new TypeError("Invalid default relay");
  }
  return Object.freeze(Object.fromEntries(fields.map(key => [key, value[key]])));
}

export const product = validateProduct(JSON.parse(readFileSync(new URL("../../branding/product.json", import.meta.url), "utf8")));
