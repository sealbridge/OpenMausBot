import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { McpHost } from "./mcp-host.mjs";
import { negotiateCapabilities } from "./capabilities.mjs";
import { developmentRuntimeDir, resolveRuntime } from "./runtime.mjs";
import { product } from "./product.mjs";

const prepared = existsSync(path.join(developmentRuntimeDir, "package.json"));
const configured = process.env.SEALBRIDGE_CLI_ENTRY;

test("live pinned CLI initializes and lists tools without relay access", { skip: !configured && !prepared }, async t => {
  const runtime = configured ? { cliEntry: path.resolve(configured) } : resolveRuntime();
  const manifest = JSON.parse(readFileSync(path.resolve(path.dirname(runtime.cliEntry), "../../../package.json"), "utf8"));
  assert.equal(manifest.version, product.cliVersion);
  const host = new McpHost({ ...runtime, timeoutMs: 10000 });
  t.after(() => host.close());
  const { initialize, catalog } = await host.start();
  assert.equal(initialize.serverInfo.name, "sealbridge-mcp-server");
  const capabilities = negotiateCapabilities(initialize, catalog);
  assert.equal(capabilities.serverVersion, product.cliVersion);
  assert.equal(capabilities.protocolVersion, "2024-11-05");
  assert.equal(capabilities.tools.length, 14);
  assert.equal(capabilities.features.hostApproval, false);
  assert.ok(capabilities.tools.includes("acp_message_status"));
  assert.ok(capabilities.tools.includes("acp_list_invites"));
  assert.ok(capabilities.tools.includes("acp_remove_invite"));
  await host.close();
  assert.equal(host.running, false);
});
