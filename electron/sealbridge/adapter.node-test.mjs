import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdapter } from "./adapter.mjs";
import { product } from "./product.mjs";

const recorded = JSON.parse(readFileSync(new URL("./fixtures/cli-0.2.2.json", import.meta.url), "utf8"));
function mockHost(negotiation = recorded) {
  const calls = [];
  return { calls, async start() { return negotiation; }, async close() {},
    async callTool(name, args) {
      calls.push({ name, args });
      return { structuredContent: { workers: [{ name: "Fixture worker", description: "Public directory card", agentDid: "did:example:worker", inviteToken: "fixture-only" }] } };
    },
  };
}

test("0.2.2 bootstrap returns public status; discovery does not imply open access", async () => {
  const host = mockHost();
  const adapter = createAdapter({ host, identityStore: { getPublicInfo: async () => ({ did: "did:example:owner", publicKey: "public", privateKey: "fixture-only" }) } });
  const statuses = [];
  const unsubscribe = adapter.onStatus(value => statuses.push(value));
  const result = await adapter.bootstrap();
  assert.equal(result.value.productName, product.productName);
  assert.deepEqual(result.value.identity, { did: "did:example:owner", publicKey: "public" });
  assert.equal(result.value.sendingEnabled, false);
  assert.equal(result.value.identityMode, "ephemeral");
  assert.equal(statuses.length, 1);
  unsubscribe();
  assert.deepEqual(await adapter.listPublicWorkers("fixture"), { ok: true, value: { workers: [{ name: "Fixture worker", description: "Public directory card", agentDid: "did:example:worker", accessMode: "unknown" }], openAccessKnown: false } });
  assert.deepEqual(host.calls, [{ name: "acp_discover_workers", args: { relayUrl: product.defaultRelay } }]);
  assert.equal((await adapter.listPublicWorkers("acp-invite:fixture-only")).error.code, "SEALBRIDGE_INPUT_INVALID");
  await adapter.close();
});

test("unreleased operations return a stable typed result and never call the host", async () => {
  const host = mockHost();
  let imported = false;
  const adapter = createAdapter({ host, inviteImporter: { importInvite() { imported = true; } }, approvalChannel: {}, requestChannel: { submitRequest() { throw new Error("must not send"); } } });
  await adapter.bootstrap();
  for (const result of await Promise.all([
    adapter.importInvite("acp-invite:fixture-only"), adapter.submitRequest("did:example:worker", {}),
    adapter.answerApproval("id", "accept"), adapter.cancelRequest("id"), adapter.getRequest("id"),
  ])) assert.equal(result.error.code, "SEALBRIDGE_NOT_SUPPORTED");
  assert.equal(imported, false);
  assert.equal(host.calls.length, 0);
  assert.equal(typeof adapter.onApproval(() => {}), "function");
});

test("approval signals alone do not send; explicit provider hooks preserve callers", async () => {
  const negotiated = structuredClone(recorded);
  negotiated.initialize.capabilities.experimental = { sealbridge: { hostApproval: true, elicitation: true, inviteImport: true } };
  negotiated.catalog.tools.push({ name: "acp_list_invites" });
  const withoutChannel = createAdapter({ host: mockHost(negotiated) });
  assert.equal((await withoutChannel.bootstrap()).value.sendingEnabled, false);
  assert.equal((await withoutChannel.submitRequest("alias", {})).error.code, "SEALBRIDGE_NOT_SUPPORTED");
  const calls = [];
  const adapter = createAdapter({ host: mockHost(negotiated), approvalChannel: {},
    inviteImporter: { async importInvite(input) { calls.push(input); return { alias: "opaque-alias", privateKey: "fixture-only" }; } },
    requestChannel: { async submitRequest({ targetRef }) { calls.push(targetRef); return { handle: "request-1", privateKey: "fixture-only" }; } },
  });
  assert.equal((await adapter.bootstrap()).value.sendingEnabled, true);
  assert.deepEqual(await adapter.importInvite("acp-invite:fixture-only"), { ok: true, value: { alias: "opaque-alias", contact: null } });
  assert.deepEqual(await adapter.submitRequest("opaque-alias", { title: "Fixture" }), { ok: true, value: { handle: "request-1" } });
  assert.equal((await adapter.submitRequest("acp-invite:fixture-only", {})).error.code, "SEALBRIDGE_INPUT_INVALID");
  assert.equal((await adapter.submitRequest("opaque-alias", { inviteToken: "fixture-only" })).error.code, "SEALBRIDGE_INPUT_INVALID");
  assert.deepEqual(calls, ["acp-invite:fixture-only", "opaque-alias"]);
  await adapter.close();
  assert.equal((await adapter.submitRequest("opaque-alias", {})).error.code, "SEALBRIDGE_NOT_SUPPORTED");
});

test("unknown versions and missing discovery remain unsupported; provider errors are opaque", async () => {
  const adapter = createAdapter({ host: mockHost({ initialize: { serverInfo: { version: "99.0.0" } }, catalog: {} }) });
  await adapter.bootstrap();
  assert.equal((await adapter.listPublicWorkers()).error.code, "SEALBRIDGE_NOT_SUPPORTED");
  assert.equal((await adapter.submitRequest("alias", {})).error.code, "SEALBRIDGE_NOT_SUPPORTED");
  const failing = createAdapter({ host: { async start() { throw new Error("acp-invite:fixture-only"); } } });
  assert.doesNotMatch(JSON.stringify(await failing.bootstrap()), /fixture-only/);
});

test("identity bootstrap failure closes the host and keeps operations disabled", async () => {
  const host = mockHost();
  let closed = false;
  host.close = async () => { closed = true; };
  const adapter = createAdapter({ host, identityStore: { async getPublicInfo() { throw new Error("fixture-only"); } } });
  assert.equal((await adapter.bootstrap()).error.code, "SEALBRIDGE_OPERATION_FAILED");
  assert.equal(closed, true);
  assert.equal((await adapter.listPublicWorkers()).error.code, "SEALBRIDGE_NOT_SUPPORTED");
});
