import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { negotiateCapabilities } from "./capabilities.mjs";

export const recorded = JSON.parse(readFileSync(new URL("./fixtures/cli-0.2.2.json", import.meta.url), "utf8"));

test("recorded 0.2.2 negotiation enables only published tool features", () => {
  const result = negotiateCapabilities(recorded.initialize, recorded.catalog);
  assert.equal(result.serverVersion, "0.2.2");
  assert.equal(result.protocolVersion, "2024-11-05");
  assert.equal(result.tools.length, 7);
  assert.equal(result.features.delegate, true);
  assert.equal(result.features.discover, true);
  assert.equal(result.features.hostApproval, false);
  assert.equal(result.features.inviteAliases, false);
  assert.equal(result.features.openWorkerDiscovery, false);
  assert.equal(result.features.identityBootstrap, false);
  assert.equal(result.features.inviteImport, false);
  assert.equal(result.features.relayAuthRecovery, false);
  assert.equal(result.features.requestStatus, false);
  assert.equal(result.features.requestCancellation, false);
  assert.ok(Object.isFrozen(result.features));
  assert.ok(Object.isFrozen(result.tools));
});

test("unknown or newer versions do not imply approval or other unpublished contracts", () => {
  for (const version of [undefined, "0.2.3", "99.0.0"]) {
    const result = negotiateCapabilities({ serverInfo: { version }, capabilities: { elicitation: {}, tools: {} } }, { tools: [{ name: "acp_delegate_task" }, { name: "acp_list_invites" }] });
    assert.equal(result.features.inviteAliases, true);
    assert.equal(result.features.hostApproval, false);
    assert.equal(result.features.inviteImport, false);
  }
  assert.ok(Object.values(negotiateCapabilities().features).every(value => !value));
  assert.ok(Object.values(negotiateCapabilities(null, null).features).every(value => !value));
});

test("provisional extension hooks require explicit affirmative signals", () => {
  const flags = { hostApproval: true, elicitation: true, openWorkerDiscovery: true, identityBootstrap: true,
    inviteImport: true, relayAuthRecovery: true, requestStatus: true, requestCancellation: true };
  const initialize = { capabilities: { experimental: { sealbridge: flags } } };
  const tools = { tools: [...recorded.catalog.tools, { name: "acp_list_invites" }] };
  const result = negotiateCapabilities(initialize, tools);
  assert.ok(Object.values(result.features).every(Boolean));
  flags.elicitation = false;
  assert.equal(negotiateCapabilities(initialize, tools).features.hostApproval, false);
  assert.equal(negotiateCapabilities(initialize).features.openWorkerDiscovery, false);
});
