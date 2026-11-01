import { EventEmitter } from "node:events";
import { product } from "./product.mjs";
import { McpHost } from "./mcp-host.mjs";
import { resolveRuntime } from "./runtime.mjs";
import { negotiateCapabilities } from "./capabilities.mjs";
import { notSupported } from "./errors.mjs";
import { containsSecret, publicString } from "./redaction.mjs";

const ok = value => ({ ok: true, value });
const invalid = () => ({ ok: false, error: { code: "SEALBRIDGE_INPUT_INVALID" } });
const failed = () => ({ ok: false, error: { code: "SEALBRIDGE_OPERATION_FAILED" } });

function identityInfo(value) {
  if (!value || typeof value.did !== "string" || typeof value.publicKey !== "string") return null;
  return { did: publicString(value.did), publicKey: publicString(value.publicKey) };
}

function workerInfo(worker) {
  const info = {};
  for (const key of ["name", "description", "ownerDid", "agentDid", "relayEndpoint", "expiresAt", "version"]) {
    if (typeof worker?.[key] === "string") info[key] = publicString(worker[key]);
  }
  // Directory membership in 0.2.2 does not establish that a worker accepts open requests.
  return { ...info, accessMode: "unknown" };
}

/** Provisional main-only API. Providers are trusted main-process integrations, never renderer callbacks.
 * inviteImporter.importInvite receives transient secret input outside MCP; only its alias/public fields leave main.
 * requestChannel owns future core argument mapping, approval correlation, status, and cancellation contracts.
 */
export function createAdapter({ host: injectedHost, runtime, identityStore, inviteImporter, approvalChannel, requestChannel } = {}) {
  let host = injectedHost;
  let capabilities;
  let boot;
  let ready = false;
  const events = new EventEmitter();
  const subscribe = (name, callback) => { events.on(name, callback); return () => events.off(name, callback); };
  async function operation(name, action) {
    try { return await action(); }
    catch { return { ...failed(), operation: name }; }
  }
  const canSend = () => !!(ready && capabilities?.features.delegate && capabilities.features.hostApproval && approvalChannel && requestChannel?.submitRequest);
  return Object.freeze({
    bootstrap() {
      boot ??= operation("bootstrap", async () => {
        try {
          host ??= new McpHost(runtime ?? resolveRuntime());
          const { initialize, catalog } = await host.start();
          const identity = identityStore ? identityInfo(await identityStore.getPublicInfo()) : null;
          capabilities = negotiateCapabilities(initialize, catalog);
          ready = true;
          const status = { state: "ready", productName: product.productName, relayUrl: product.defaultRelay,
            identity, identityMode: identity && capabilities.features.identityBootstrap ? "provider" : "ephemeral", capabilities, sendingEnabled: canSend() };
          events.emit("status", status);
          return ok(status);
        } catch {
          ready = false;
          capabilities = undefined;
          await host?.close();
          return failed();
        }
      });
      return boot;
    },
    importInvite(secretInput) {
      if (!capabilities?.features.inviteImport || !inviteImporter?.importInvite) return Promise.resolve(notSupported("importInvite"));
      return operation("importInvite", async () => {
        const result = await inviteImporter.importInvite(secretInput);
        if (typeof result?.alias !== "string" || containsSecret(result.alias)) return failed();
        return ok({ alias: result.alias, contact: identityInfo(result.contact) });
      });
    },
    listPublicWorkers(query = "") {
      if (!capabilities?.features.discover) return Promise.resolve(notSupported("listPublicWorkers"));
      if (typeof query !== "string" || query.length > 512 || containsSecret(query)) return Promise.resolve(invalid());
      return operation("listPublicWorkers", async () => {
        const result = await host.callTool("acp_discover_workers", { relayUrl: product.defaultRelay });
        if (result?.isError) return failed();
        const payload = result?.structuredContent ?? JSON.parse(result?.content?.find(item => item.type === "text")?.text ?? "null");
        if (!Array.isArray(payload?.workers)) return failed();
        const workers = payload.workers.slice(0, 1000).map(workerInfo)
          .filter(worker => `${worker.name ?? ""} ${worker.description ?? ""}`.toLowerCase().includes(query.toLowerCase()));
        return ok({ workers, openAccessKnown: false });
      });
    },
    submitRequest(targetRef, draft) {
      if (!canSend()) return Promise.resolve(notSupported("submitRequest"));
      if (typeof targetRef !== "string" || !targetRef || containsSecret({ targetRef, draft })) return Promise.resolve(invalid());
      return operation("submitRequest", async () => {
        const result = await requestChannel.submitRequest({ targetRef, draft, host, approvalChannel, capabilities });
        if (typeof result?.handle !== "string" || containsSecret(result.handle)) return failed();
        return ok({ handle: result.handle });
      });
    },
    onApproval(callback) {
      if (!capabilities?.features.hostApproval || !approvalChannel?.onApproval) return () => {};
      return approvalChannel.onApproval(value => {
        if (containsSecret(value)) return;
        callback(value);
      });
    },
    answerApproval(id, decision) {
      if (!capabilities?.features.hostApproval || !approvalChannel?.answerApproval) return Promise.resolve(notSupported("answerApproval"));
      if (typeof id !== "string" || containsSecret(id) || !["accept", "decline", "cancel"].includes(decision)) return Promise.resolve(invalid());
      return operation("answerApproval", async () => { await approvalChannel.answerApproval(id, decision); return ok(null); });
    },
    onStatus(callback) { return subscribe("status", callback); },
    cancelRequest(handle) {
      if (!capabilities?.features.requestCancellation || !requestChannel?.cancelRequest) return Promise.resolve(notSupported("cancelRequest"));
      if (typeof handle !== "string" || containsSecret(handle)) return Promise.resolve(invalid());
      return operation("cancelRequest", async () => { await requestChannel.cancelRequest(handle); return ok(null); });
    },
    getRequest(handle) {
      if (!capabilities?.features.requestStatus || !requestChannel?.getRequest) return Promise.resolve(notSupported("getRequest"));
      if (typeof handle !== "string" || containsSecret(handle)) return Promise.resolve(invalid());
      return operation("getRequest", async () => {
        const result = await requestChannel.getRequest(handle);
        if (containsSecret(result)) return failed();
        return ok(result);
      });
    },
    async close() { ready = false; capabilities = undefined; await host?.close(); events.removeAllListeners(); },
  });
}
