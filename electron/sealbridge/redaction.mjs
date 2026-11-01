import { product } from "./product.mjs";

const escapedScheme = product.urlScheme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const secretLink = new RegExp(`(?:acp-invite:|acp://invite|${escapedScheme}://)[^\\s\\x22<>]*`, "gi");

export function redact(value) {
  return String(value)
    .replace(secretLink, "[REDACTED]")
    .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-\r\n]*PRIVATE KEY-----|$)/gi, "[REDACTED]")
    .replace(/((?:["']?(?:private[_-]?key(?:hex|pem)?|secret[_-]?key|seed)["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,}]+)/gi, "$1[REDACTED]")
    .replace(/\b[0-9a-f]{64,}\b/gi, "[REDACTED]");
}

export function containsSecret(value) {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined || redact(serialized) !== serialized ||
      /"(?:inviteToken|privateKey|secretKey|seed)"\s*:/i.test(serialized);
  } catch { return true; }
}

export function publicString(value, max = 512) {
  return typeof value === "string" ? redact(value).slice(0, max) : undefined;
}
