import { publicString } from "./redaction.mjs";

export const shortDid = did => `${did.slice(0, 16)}…${did.slice(-8)}`;

export function createSendApproval({ sdk, owner, signApproval, ask }) {
  return {
    kind: "human", ownerDecision: true,
    async approve(request) {
      const manifest = request.details?.manifest;
      const grant = manifest?.contextGrant;
      if (!grant || !["view_only", "hand_over"].includes(grant.deliveryMode)) throw new Error("INVALID_APPROVAL");
      const { grantDigest } = sdk.contextGrantAuditPayload(grant);
      const card = { gate: request.gate, recipient: shortDid(manifest.worker.ownerDid),
        mode: grant.deliveryMode, angle: publicString(grant.angle, 120),
        allowedCount: (grant.fieldsAllowed?.length ?? 0), deniedCount: (grant.fieldsDenied?.length ?? 0),
        bytes: request.details.bytes, expiresAt: grant.expiresAt, digest: grantDigest,
        deliverableDigest: request.details.deliverableDigest,
        deliverable: request.gate === "final_verification" ? publicString(JSON.stringify(request.target?.artifact?.payload?.data), 65536) : undefined };
      const decision = await ask(card, request.signal);
      let current;
      try { current = sdk.contextGrantAuditPayload(request.details.manifest.contextGrant).grantDigest; } catch {}
      return signApproval(request.taskId, request.gate, request.target, owner,
        decision === true && current === card.digest && !request.signal?.aborted ? "APPROVED" : "REJECTED");
    },
  };
}
