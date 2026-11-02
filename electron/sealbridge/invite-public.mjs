import { redact } from "./redaction.mjs";

export function publicInvite(value) {
  if (!value || !/^saved:[a-f0-9]{64}$/.test(value.workerRef) ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.alias) ||
      !/^did:key:z[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(value.ownerDid) ||
      !Number.isFinite(Date.parse(value.effectiveExpiresAt))) throw new Error("INVITE_RESULT_INVALID");
  return { workerRef: value.workerRef, alias: value.alias,
    ownerDid: value.ownerDid, effectiveExpiresAt: new Date(value.effectiveExpiresAt).toISOString(),
    displayName: redact(value.displayName ?? "").split("").filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join("").slice(0, 120),
    peerDid: value.ownerDid.slice(0, 18) + "…" + value.ownerDid.slice(-8),
    expiresAt: new Date(value.effectiveExpiresAt).toISOString(), state: "pending", owned: value.owned === true };
}
