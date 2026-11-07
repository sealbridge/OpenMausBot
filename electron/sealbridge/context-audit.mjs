import path from "node:path";
import { lstat, readdir, readFile, rm } from "node:fs/promises";
import { publicString } from "./redaction.mjs";
import { loadContextSdk } from "./context-pooling.mjs";

const CONTEXT_EVENTS = new Set(["CONTEXT_GRANT", "CONTEXT_MODE", "CONTEXT_OPENED", "CONTEXT_DISCARDED", "CONTEXT_DELETION_ATTEMPTED"]);
const MODES = new Set(["view_only", "hand_over", "approval_redelegation"]);
const MAX_AUDIT_BYTES = 2 * 1024 * 1024;
const hidden = () => ({ verified: false, outputRetained: false });

export function auditFileName(id) {
  if (typeof id !== "string" || id.length > 180 || id.includes("..") || id.includes("/") || id.includes("\\")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.jsonl$/.test(id)) return null;
  if (id.endsWith(".tasks.jsonl") || id.endsWith(".errors.jsonl")) return null;
  return id;
}

function auditDirectory(dataDir) {
  if (!path.isAbsolute(dataDir ?? "")) return null;
  return path.resolve(dataDir, "context-audits");
}

function contained(directory, target) {
  const root = directory.endsWith(path.sep) ? directory : directory + path.sep;
  const left = process.platform === "win32" ? target.toLowerCase() : target;
  const right = process.platform === "win32" ? root.toLowerCase() : root;
  return left.startsWith(right);
}

/** Verified projection. Input stays in the audit file and never leaves this function. */
export function projectAuditRecord(bundle, verifyAudit) {
  let result;
  try { result = verifyAudit(bundle); }
  catch { return hidden(); }
  if (!result?.valid || !bundle || typeof bundle !== "object" || !Array.isArray(bundle.entries)) return hidden();
  let deliveryMode, conflict = false, output;
  for (const entry of bundle.entries) {
    const eventType = entry?.body?.eventType;
    const payload = entry?.body?.payload;
    if (typeof eventType !== "string" || !payload || typeof payload !== "object") continue;
    if (CONTEXT_EVENTS.has(eventType)) {
      const mode = payload.deliveryMode;
      if (!MODES.has(mode) || typeof payload.grantDigest !== "string") conflict = true;
      else if (deliveryMode && deliveryMode !== mode) conflict = true;
      else deliveryMode = mode;
    } else if (eventType === "DELIVER" && payload.artifact?.payload?.type === "Artifact") {
      const data = payload.artifact.payload.data;
      if (typeof data === "string" && data.length > 0) output = data;
      else if (data !== undefined && data !== null) output = output ?? null;
    }
  }
  if (conflict) deliveryMode = undefined;
  const outputRetained = typeof output === "string" || output === null;
  const record = { verified: true, outputRetained };
  if (deliveryMode) record.deliveryMode = deliveryMode;
  if (deliveryMode === "hand_over" && typeof output === "string") {
    const deliverable = publicString(output, 65536);
    if (deliverable) record.deliverable = deliverable;
  }
  return record;
}

async function readAudit(target, sdk) {
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > MAX_AUDIT_BYTES) return hidden();
    const text = await readFile(target, "utf8");
    return projectAuditRecord(sdk.parseAuditJsonl(text), bundle => sdk.verifyAudit(bundle));
  } catch { return hidden(); }
}

export async function listContextAudits({ dataDir, loadSdk = loadContextSdk }) {
  const directory = auditDirectory(dataDir);
  if (!directory) return [];
  let names;
  try { names = await readdir(directory); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  let sdk;
  try { sdk = await loadSdk(); }
  catch { sdk = null; }
  const records = [];
  for (const name of names.sort()) {
    if (!auditFileName(name)) continue;
    const target = path.resolve(directory, name);
    if (!contained(directory, target)) continue;
    records.push({ id: name, ...(sdk ? await readAudit(target, sdk) : hidden()) });
  }
  return records;
}

export async function deleteContextAudit({ dataDir, id }) {
  const name = auditFileName(id);
  const directory = auditDirectory(dataDir);
  if (!name || !directory) return { ok: false };
  const target = path.resolve(directory, name);
  if (!contained(directory, target)) return { ok: false };
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) return { ok: false };
    await rm(target);
    return { ok: true };
  } catch { return { ok: false }; }
}

export function registerContextAuditIpc({ ipcMain, localOnly, dataDir, loadSdk }) {
  ipcMain.handle("sealbridge:received-audits", localOnly("sealbridge:received-audits", () => listContextAudits({ dataDir, loadSdk })));
  ipcMain.handle("sealbridge:received-audit-delete", localOnly("sealbridge:received-audit-delete", (_event, id) => deleteContextAudit({ dataDir, id })));
}
