import path from "node:path";
import { product } from "./product.mjs";
import { McpHost } from "./mcp-host.mjs";
import { developmentRuntimeDir, resolveRuntime } from "./runtime.mjs";

export function createCoreService({ dataDir, resourcesPath, runtimeDir = developmentRuntimeDir,
  nodeBinary = process.execPath, hostFactory = options => new McpHost(options), maxRestarts = 5,
  backoffMs = 1000 } = {}) {
  let status = { state: "starting", did: null, version: null };
  let host, pending, timer, stopped = false, attempts = 0, unavailable = false;
  const snapshot = () => ({ ...status });
  function recover() {
    if (stopped || unavailable || timer) return;
    status = { ...status, state: attempts >= maxRestarts ? "failed" : "restarting" };
    if (attempts >= maxRestarts) return;
    timer = setTimeout(() => {
      timer = undefined;
      void start();
    }, Math.min(30000, backoffMs * 2 ** attempts++));
  }
  function start() {
    if (stopped) return Promise.resolve(snapshot());
    pending ??= (async () => {
      status = { ...status, state: "starting" };
      try {
        await host?.close();
        if (stopped) return snapshot();
        const runtime = resolveRuntime({ resourcesPath, runtimeDir, nodeBinary });
        const root = resourcesPath ? path.join(resourcesPath, "sealbridge-runtime") : runtimeDir;
        host = hostFactory({ ...runtime, cliEntry: path.join(root, "core-child.mjs"), dataDir,
          timeoutMs: 15000,
          onIdentity(did) { status = { ...status, did }; },
          onUnavailable() { unavailable = true; status = { ...status, state: "key-store-unavailable" }; },
          onExit: recover,
        });
        const { initialize } = await host.start();
        if (!status.did) throw new Error();
        if (!stopped) status = { ...status, state: "ready", version: initialize.serverInfo.version === product.cliVersion ? product.cliVersion : null };
      } catch {
        if (unavailable) status = { ...status, state: "key-store-unavailable" };
        else recover();
      }
      return snapshot();
    })().finally(() => { pending = undefined; });
    return pending;
  }
  return Object.freeze({
    start, status: snapshot,
    async retry() {
      if (stopped) return snapshot();
      clearTimeout(timer); timer = undefined;
      if (pending) await pending;
      unavailable = false; attempts = 0;
      return start();
    },
    async close() {
      stopped = true;
      clearTimeout(timer); timer = undefined;
      await host?.close();
      await pending;
      status = { ...status, state: "stopped" };
    },
  });
}

export function registerCoreIpc({ ipcMain, localOnly, service }) {
  ipcMain.handle("sealbridge:status", localOnly("sealbridge:status", () => service.status()));
  ipcMain.handle("sealbridge:retry", localOnly("sealbridge:retry", () => service.retry()));
}
