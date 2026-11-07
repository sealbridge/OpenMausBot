import { publicString } from "./redaction.mjs";

export function contextGrantSummary(sdk, grant, bytes) {
  const { grantDigest } = sdk.contextGrantAuditPayload(grant);
  return { mode: grant.deliveryMode, angle: publicString(grant.angle, 120),
    allowedCount: grant.fieldsAllowed?.length ?? 0, deniedCount: grant.fieldsDenied?.length ?? 0,
    bytes, expiresAt: grant.expiresAt, retention: grant.retention === "keep_deliverable" ? "deliverable" : "none",
    digest: grantDigest.slice(0, 16) };
}

export function receivedContextSummary(sdk, manifest, input, now = Date.now()) {
  sdk.validateContextGrantUse(manifest, input, now);
  if (!manifest.contextGrant) return null;
  return contextGrantSummary(sdk, manifest.contextGrant, Buffer.byteLength(JSON.stringify(input), "utf8"));
}
