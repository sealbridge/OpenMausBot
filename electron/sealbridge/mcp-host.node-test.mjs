import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { McpHost, sanitizedEnvironment } from "./mcp-host.mjs";
import { fixtureRuntime } from "./fixtures/runtime.mjs";
import { product } from "./product.mjs";

async function fixture(t, mode = "normal", options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), `${product.dataDirName}-fixture with spaces-`));
  const cliEntry = path.join(dir, "fake-mcp-server.mjs");
  await copyFile(new URL("./fixtures/fake-mcp-server.mjs", import.meta.url), cliEntry);
  await writeFile(path.join(dir, "fixture.json"), JSON.stringify({ mode, urlScheme: product.urlScheme }));
  const host = new McpHost({ timeoutMs: 1500, shutdownMs: 50, ...options, cliEntry });
  t.after(async () => { await host.close(); await rm(dir, { recursive: true, force: true }); });
  return host;
}

test("environment forwards only OS/locale fields and isolates home", () => {
  const env = sanitizedEnvironment({ PATH: "untrusted", NODE_OPTIONS: "injected", API_KEY: "fixture-only", ACP_DATA_DIR: "live", HOME: "live", SystemRoot: "os", LANG: "C", TZ: "acp-invite:fixture-only" }, "fixture");
  assert.equal(env.SystemRoot, "os");
  assert.equal(env.HOME, "fixture");
  assert.equal(env.USERPROFILE, "fixture");
  for (const key of ["PATH", "NODE_OPTIONS", "API_KEY", "ACP_DATA_DIR", "TZ"]) assert.equal(env[key], undefined);
});

test("host initializes, sends initialized notification, lists tools and correlates concurrent responses", async t => {
  const host = await fixture(t);
  const { catalog } = await host.start();
  assert.equal(catalog.tools[0].name, "acp_discover_workers");
  const results = await Promise.all([host.request("fixture/concurrent", { delay: 20 }), host.request("fixture/concurrent", { delay: 1 })]);
  assert.deepEqual(results, [{ delay: 20 }, { delay: 1 }]);
  const env = await host.request("fixture/environment");
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.notEqual(env.HOME, process.env.HOME);
  await host.close();
  assert.equal(host.running, false);
  await assert.rejects(host.request("ping"), { code: "SEALBRIDGE_HOST_CLOSED" });
});

test("frames can span chunks and use CRLF", async t => {
  const host = await fixture(t, "split");
  await host.start();
  assert.deepEqual(await host.request("ping"), {});
});

for (const [mode, code] of [["garbage", "SEALBRIDGE_FRAME_INVALID"], ["invalid", "SEALBRIDGE_FRAME_INVALID"],
  ["oversized", "SEALBRIDGE_MESSAGE_TOO_LARGE"], ["slow", "SEALBRIDGE_REQUEST_TIMEOUT"], ["hang", "SEALBRIDGE_REQUEST_TIMEOUT"], ["exit", "SEALBRIDGE_HOST_EXITED"]]) {
  test(`host rejects ${mode} and shuts down`, async t => {
    const host = await fixture(t, mode, { maxMessageBytes: 1024, timeoutMs: 500 });
    await assert.rejects(host.start(), { code });
    assert.equal(host.running, false);
    await host.close();
  });
}

test("timeout rejects all pending calls without replay", async t => {
  const host = await fixture(t);
  await host.start();
  const pending = [host.request("fixture/slow"), host.request("fixture/slow")];
  const results = await Promise.allSettled(pending);
  assert.ok(results.every(result => result.status === "rejected" && result.reason.code === "SEALBRIDGE_REQUEST_TIMEOUT"));
  await host.close();
});

test("tool arguments refuse secret values and remote RPC text is not exposed", async t => {
  const host = await fixture(t);
  await host.start();
  await assert.rejects(host.callTool("acp_delegate_task", { inviteToken: "fixture-only" }), { code: "SEALBRIDGE_SECRET_ARGUMENT_REFUSED" });
  await assert.rejects(host.request("tools/call", { arguments: { link: "acp-invite:fixture-only" } }), { code: "SEALBRIDGE_SECRET_ARGUMENT_REFUSED" });
  await assert.rejects(host.request("fixture/rpc-error"), error => error.code === "SEALBRIDGE_RPC_ERROR" && !error.message.includes("fixture-only"));
  assert.deepEqual(await host.request("ping"), {});
});

test("stderr is bounded and redacted across writes", async t => {
  const host = await fixture(t, "normal", { maxStderrBytes: 512 });
  await host.start();
  await host.request("fixture/stderr");
  await host.close();
  assert.ok(Buffer.byteLength(host.stderr) <= 512);
  assert.doesNotMatch(host.stderr, /fixture-only|fixture-key|BEGIN PRIVATE/);
  assert.match(host.stderr, /REDACTED/);
});

test("missing entry and oversized outgoing frames terminate without exposing raw errors", async t => {
  const host = await fixture(t, "normal", { maxMessageBytes: 1024 });
  await host.start();
  await assert.rejects(host.request("ping", { text: "x".repeat(2000) }), { code: "SEALBRIDGE_MESSAGE_INVALID" });
  await host.close();
  const missing = new McpHost({ cliEntry: path.resolve("not-a-cli.js") });
  await assert.rejects(missing.start(), { code: "SEALBRIDGE_HOST_EXITED" });
  await missing.close();
  assert.throws(() => new McpHost({ cliEntry: "relative.js" }));
  assert.throws(() => new McpHost({ cliEntry: path.resolve("cli.js"), nodeBinary: path.resolve("node.cmd") }));
});

test("post-start framing failures notify once; intentional shutdown does not notify", async t => {
  let exits = 0;
  const host = await fixture(t, "normal", { onExit() { exits++; } });
  await host.start();
  await assert.rejects(host.request("fixture/garbage"), { code: "SEALBRIDGE_FRAME_INVALID" });
  await host.close();
  assert.equal(exits, 1);
  const normal = await fixture(t, "normal", { onExit() { exits++; } });
  await normal.start();
  await normal.close();
  assert.equal(exits, 1);
});

test("service recovers a real child after a post-start framing failure", { timeout: 10000 }, async t => {
  const { createCoreService } = await import("./service.mjs");
  const hosts = [];
  const recovered = Promise.withResolvers();
  const service = createCoreService({ runtimeDir: await fixtureRuntime(t), backoffMs: 10, hostFactory(options) {
    const host = { async start() {
      const child = await fixture(t, "normal", options);
      hosts.push(child);
      options.onIdentity("did:key:fixture");
      const result = await child.start();
      if (hosts.length === 2) recovered.resolve();
      return result;
    }, async close() { await hosts.at(-1)?.close(); } };
    return host;
  } });
  t.after(() => service.close());
  assert.equal((await service.start()).state, "ready");
  assert.equal(hosts.length, 1);
  await assert.rejects(hosts[0].request("fixture/garbage"), { code: "SEALBRIDGE_FRAME_INVALID" });
  assert.equal(service.status().state, "restarting");
  await recovered.promise;
  await service.start();
  assert.equal(service.status().state, "ready");
  assert.equal(hosts.length, 2);
});
