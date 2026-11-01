import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createCoreService, registerCoreIpc } from "./service.mjs";

const did = "did:key:z6MkiTBz1yUom";
function fixture(options = {}) {
  const hosts = [];
  let running = 0;
  const service = createCoreService({ dataDir: "/unused-fixture-data", backoffMs: 10, maxRestarts: 2,
    hostFactory(settings) {
      const host = {
        async start() {
          running++;
          settings.onIdentity(did);
          return { initialize: { serverInfo: { version: "0.2.2", secret: "fixture-secret" } } };
        },
        async close() { if (!host.closed) { host.closed = true; running--; } },
        crash: () => settings.onExit(), unavailable: () => settings.onUnavailable(),
      };
      hosts.push(host);
      return host;
    }, ...options });
  return { service, hosts, running: () => running };
}

test("service exposes only public status and bounds crash recovery with backoff", async t => {
  const { service, hosts, running } = fixture();
  t.after(() => service.close());
  await service.start();
  assert.deepEqual(service.status(), { state: "ready", did, version: "0.2.2" });
  hosts[0].crash();
  assert.equal(service.status().state, "restarting");
  assert.equal(hosts.length, 1);
  await delay(40);
  assert.equal(hosts.length, 2);
  hosts[1].crash();
  await delay(60);
  assert.equal(hosts.length, 3);
  hosts[2].crash();
  assert.equal(service.status().state, "failed");
  await delay(40);
  assert.equal(hosts.length, 3);
  await service.retry();
  assert.equal(hosts.length, 4);
  await service.close();
  assert.equal(running(), 0);
});

test("unavailable key store stops automatic retries; quit cancels recovery", async () => {
  const { service, hosts } = fixture();
  await service.start();
  hosts[0].unavailable(); hosts[0].crash();
  assert.equal(service.status().state, "key-store-unavailable");
  await delay(40);
  assert.equal(hosts.length, 1);
  await service.retry();
  assert.equal(service.status().state, "ready");
  hosts[1].crash();
  await service.close();
  await delay(40);
  assert.equal(hosts.length, 2);
  assert.equal(service.status().state, "stopped");
});

test("fixed IPC methods enforce local sender checks and discard renderer arguments", async t => {
  const { service } = fixture();
  t.after(() => service.close());
  await service.start();
  const handlers = new Map();
  registerCoreIpc({ service, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    localOnly: (_channel, handler) => (event, ...args) => {
      if (!event.local) throw new Error("Refused");
      return handler(event, ...args);
    } });
  assert.deepEqual([...handlers.keys()], ["sealbridge:status", "sealbridge:retry"]);
  assert.throws(() => handlers.get("sealbridge:status")({ local: false }));
  const response = handlers.get("sealbridge:status")({ local: true }, { privateKey: "fixture-secret" });
  assert.deepEqual(response, { state: "ready", did, version: "0.2.2" });
  assert.equal(JSON.stringify(response).includes("fixture-secret"), false);
});
