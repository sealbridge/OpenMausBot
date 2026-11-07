import path from "node:path";
import { receivedContextSummary } from "./context-grant-summary.mjs";
import { shortDid } from "./context-send-approval.mjs";

export function requireReceiveAudit(dataDir, auditPath) {
  if (!path.isAbsolute(dataDir ?? "") || !path.isAbsolute(auditPath ?? "") ||
      !path.resolve(auditPath).startsWith(path.resolve(dataDir, "context-audits") + path.sep)) throw new Error("AUDIT_PATH_REQUIRED");
}

export function createContextReceiver({ sdk, owner, signApproval, identityOptions, auditPath, dataDir,
  relay, send, workerOptions = {}, reviewOptions = {} }) {
  requireReceiveAudit(dataDir, auditPath);
  const reports = new Map(), decisions = new Map(), replies = new Map();
  let sequence = 0;
  const provider = sdk.createRuleBasedContentReviewProvider({ onReport: (_recordId, report) => {
    reports.set(report.contentDigest, { verdict: report.verdict, diagnostics: report.diagnostics.map(({ code }) => code),
      findings: [...new Map(report.findings.map(({ ruleId, severity, noteCode }) =>
        [ruleId, { ruleId, severity, noteCode }])).values()] });
  } });
  const heldReview = new sdk.HeldRequestReview(owner, { ...identityOptions, ...reviewOptions, provider: reviewOptions.provider ?? provider });
  const pending = (map, key, signal, publish) => new Promise(resolve => {
    const finish = value => { signal?.removeEventListener("abort", abort); map.delete(key); resolve(value); };
    const abort = () => finish(false);
    map.set(key, finish);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else publish();
  });
  function rows() {
    const held = heldReview.list().filter(row => row.kind === "task");
    const digests = new Set(held.map(row => row.contentDigest));
    for (const key of reports.keys()) if (!digests.has(key)) reports.delete(key);
    return held.map(row => {
      const result = { id: row.id, taskId: row.taskId, sender: shortDid(row.senderOwnerDid), state: row.state,
        inspectionStatus: row.inspectionStatus, expiresAt: row.expiresAt,
        inspection: reports.get(row.contentDigest), canOpen: decisions.has(row.taskId) };
      if (row.state === "expired" || row.inspectionStatus === "pending") return result;
      try {
        const record = heldReview.store.read(row.id);
        const content = sdk.taskContent(record.envelope, owner, row.contentDigest, row.envelopeDigest);
        result.preview = (typeof content.input === "string" ? content.input : JSON.stringify(content.input)).slice(0, 4000);
        if (content.manifest.contextGrant && Date.parse(content.manifest.contextGrant.expiresAt) <= Date.now()) {
          result.state = "expired"; result.canOpen = false;
        } else if (row.inspectionStatus === "complete") {
          result.summary = receivedContextSummary(sdk, content.manifest, content.input);
        }
      } catch { result.canOpen = false; }
      return result;
    });
  }
  const ownerApprovalProvider = {
    kind: "human", ownerDecision: true,
    async approve(request) {
      const row = heldReview.list().find(item => item.taskId === request.taskId);
      const manifest = request.details?.manifest;
      const permitted = request.gate === "contract_acceptance" && row?.inspectionStatus === "complete" &&
        row.state === "reviewable" && (!manifest?.contextGrant || ["view_only", "hand_over"].includes(manifest.contextGrant.deliveryMode));
      let approved = false;
      if (permitted) {
        const digest = manifest.contextGrant && sdk.contextGrantAuditPayload(manifest.contextGrant).grantDigest;
        approved = await pending(decisions, request.taskId, request.signal, () => send({ type: "rows", rows: rows() }));
        try {
          receivedContextSummary(sdk, manifest, request.details.input);
          approved = approved && digest === (manifest.contextGrant && sdk.contextGrantAuditPayload(manifest.contextGrant).grantDigest);
        } catch { approved = false; }
      }
      return signApproval(request.taskId, request.gate, request.target, owner,
        approved === true && !request.signal?.aborted ? "APPROVED" : "REJECTED");
    },
  };
  const adapter = { id: "desktop-human", name: "手入力", skills: [], async executeTask(context) {
    const id = ++sequence;
    const summary = receivedContextSummary(sdk, context.manifest, context.input);
    let value;
    try { value = await pending(replies, id, context.signal, () => send({ type: "compose", id, taskId: context.taskId, summary })); }
    finally { send({ type: "compose-ended", id }); }
    if (typeof value !== "string") throw new Error("OWNER_DENIED");
    return value;
  } };
  const worker = new sdk.WorkerNode({ ...workerOptions, owner, relay, identityOptions, auditPath,
    heldReview, ownerApprovalProvider, approvalProvider: ownerApprovalProvider, adapter, adapterKind: "non-llm",
    requireConnection: true, publishToRegistry: false,
    onWorkspaceCleanupError: () => send({ type: "notice", code: "WORKSPACE_CLEANUP_FAILED" }),
    onEvent: (event, taskId, error) => {
      if (event === "REJECTED") send({ type: "rejected", taskId, code: /^[A-Z_0-9]+$/.test(error?.code ?? "") ? error.code : "REQUEST_REJECTED" });
    } });
  return {
    worker, heldReview, rows,
    command(message) {
      if (message.type === "open") {
        const row = rows().find(item => item.id === message.id);
        if (!row?.canOpen || row.inspectionStatus !== "complete" || row.state !== "reviewable") return false;
        decisions.get(row.taskId)?.(true); return true;
      }
      if (message.type === "discard") {
        const row = heldReview.list().find(item => item.id === message.id);
        if (!row) return false;
        decisions.get(row.taskId)?.(false);
        return heldReview.discard(row.id);
      }
      if (message.type === "reply" && typeof message.body === "string" && message.body.trim() &&
          Buffer.byteLength(message.body) <= 65536 && replies.has(message.id)) {
        replies.get(message.id)(message.body); return true;
      }
      return false;
    },
    stop() {
      for (const finish of [...decisions.values(), ...replies.values()]) finish(false);
      worker.stop(); worker.stopDelivery(); reports.clear();
    },
  };
}
