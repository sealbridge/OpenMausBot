import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { product } from "./product.mjs";
import { SealbridgeError } from "./errors.mjs";
import { containsSecret } from "./redaction.mjs";

export function sanitizedEnvironment(source, home) {
  const allowed = new Set(["systemroot", "windir", "temp", "tmp", "lang", "lc_all", "tz", "dbus_session_bus_address", "xdg_runtime_dir"]);
  const env = Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.has(key.toLowerCase()) && !containsSecret(value)));
  return { ...env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home,
    XDG_CONFIG_HOME: home, XDG_DATA_HOME: home, ELECTRON_RUN_AS_NODE: "1" };
}

export class McpHost {
  #child;
  #home;
  #pending = new Map();
  #nextId = 1;
  #buffer = Buffer.alloc(0);
  #stderr = Buffer.alloc(0);
  #failure;
  #intentional = false;
  #closing;
  #start;
  #closed;
  #options;

  constructor({ cliEntry, nodeBinary = process.execPath, timeoutMs = 5000, shutdownMs = 250,
    maxMessageBytes = 1024 * 1024, maxStderrBytes = 8192, env = process.env, dataDir, onIdentity, onExit, onUnavailable } = {}) {
    if (!path.isAbsolute(cliEntry ?? "") || !path.isAbsolute(nodeBinary) || /\.(?:cmd|bat)$/i.test(nodeBinary) ||
        [timeoutMs, shutdownMs, maxMessageBytes, maxStderrBytes].some(n => !Number.isSafeInteger(n) || n <= 0)) {
      throw new SealbridgeError("SEALBRIDGE_HOST_OPTIONS_INVALID");
    }
    this.#options = { cliEntry, nodeBinary, timeoutMs, shutdownMs, maxMessageBytes, maxStderrBytes, env, dataDir, onIdentity, onExit, onUnavailable };
  }

  get stderr() { return this.#stderr.length ? "[REDACTED]".slice(0, this.#options.maxStderrBytes) : ""; }
  get running() { return !!this.#child && !this.#failure && !this.#closing; }

  start() {
    this.#start ??= this.#initialize();
    return this.#start;
  }

  async #initialize() {
    try {
      this.#home = await mkdtemp(path.join(tmpdir(), `${product.dataDirName}-mcp-`));
      if (this.#closing) {
        await rm(this.#home, { recursive: true, force: true });
        throw new SealbridgeError("SEALBRIDGE_HOST_CLOSED");
      }
      const { cliEntry, nodeBinary, env } = this.#options;
      this.#child = spawn(nodeBinary, [cliEntry, "mcp-server", "--relay", product.defaultRelay, "--require-approval"], {
        shell: false, windowsHide: true, cwd: this.#home, env: { ...sanitizedEnvironment(env, this.#home), ...(this.#options.dataDir ? { SEALBRIDGE_DATA_DIR: this.#options.dataDir } : {}) }, stdio: ["pipe", "pipe", "pipe", "ipc"],
      });
      this.#closed = new Promise(resolve => this.#child.once("close", resolve));
      this.#child.on("error", () => this.#fail("SEALBRIDGE_SPAWN_FAILED"));
      this.#child.on("exit", () => {
        this.#fail("SEALBRIDGE_HOST_EXITED");
      });
      this.#child.on("message", message => {
        if (message?.type === "identity" && /^did:key:z[1-9A-HJ-NP-Za-km-z]{40,100}$/.test(message.did)) this.#options.onIdentity?.(message.did);
        if (message?.type === "unavailable") this.#options.onUnavailable?.();
      });
      this.#child.stdin.on("error", () => this.#fail("SEALBRIDGE_PIPE_FAILED"));
      this.#child.stdout.on("data", chunk => this.#receive(chunk));
      this.#child.stderr.on("data", chunk => {
        // Keep a prefix so truncation cannot reveal a suffix of an invite or key.
        const remaining = this.#options.maxStderrBytes - this.#stderr.length;
        if (remaining > 0) this.#stderr = Buffer.concat([this.#stderr, chunk.subarray(0, remaining)]);
      });
      const initialize = await this.request("initialize", {
        protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: product.productName, version: "0.0.0" },
      });
      if (initialize?.protocolVersion !== "2024-11-05") throw new SealbridgeError("SEALBRIDGE_PROTOCOL_UNSUPPORTED");
      this.#write({ jsonrpc: "2.0", method: "notifications/initialized" });
      const catalog = await this.request("tools/list", {});
      return { initialize, catalog };
    } catch (error) {
      await this.close();
      throw error instanceof SealbridgeError ? error : new SealbridgeError("SEALBRIDGE_START_FAILED");
    }
  }

  request(method, params = {}) {
    if (containsSecret(params)) return Promise.reject(new SealbridgeError("SEALBRIDGE_SECRET_ARGUMENT_REFUSED"));
    if (!this.running) return Promise.reject(new SealbridgeError(this.#failure ?? "SEALBRIDGE_HOST_CLOSED"));
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.#fail("SEALBRIDGE_REQUEST_TIMEOUT"), this.#options.timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      try { this.#write({ jsonrpc: "2.0", id, method, params }); }
      catch { this.#fail("SEALBRIDGE_MESSAGE_INVALID"); }
    });
  }

  callTool(name, args = {}) {
    if (containsSecret(args)) return Promise.reject(new SealbridgeError("SEALBRIDGE_SECRET_ARGUMENT_REFUSED"));
    return this.request("tools/call", { name, arguments: args });
  }

  #write(message) {
    const json = JSON.stringify(message);
    if (Buffer.byteLength(json) > this.#options.maxMessageBytes) throw new SealbridgeError("SEALBRIDGE_MESSAGE_TOO_LARGE");
    this.#child.stdin.write(json + "\n");
  }

  #receive(chunk) {
    if (this.#failure || this.#closing) return;
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset);
      const end = newline === -1 ? chunk.length : newline;
      if (this.#buffer.length + end - offset > this.#options.maxMessageBytes) return this.#fail("SEALBRIDGE_MESSAGE_TOO_LARGE");
      this.#buffer = Buffer.concat([this.#buffer, chunk.subarray(offset, end)]);
      if (newline === -1) return;
      const line = this.#buffer.toString("utf8").trim();
      this.#buffer = Buffer.alloc(0);
      offset = newline + 1;
      if (!line) continue;
      try {
        const frame = JSON.parse(line);
        if (!frame || frame.jsonrpc !== "2.0" || Array.isArray(frame)) throw new Error();
        if (typeof frame.method === "string") {
          // G0 does not advertise elicitation. Unhandled server requests fail closed.
          if (frame.id !== undefined) this.#write({ jsonrpc: "2.0", id: frame.id, error: { code: -32601, message: "Method not supported" } });
          continue;
        }
        if (!("id" in frame) || (("result" in frame) === ("error" in frame))) throw new Error();
        const pending = this.#pending.get(frame.id);
        if (!pending) continue;
        this.#pending.delete(frame.id);
        clearTimeout(pending.timer);
        if (frame.error) pending.reject(new SealbridgeError("SEALBRIDGE_RPC_ERROR"));
        else pending.resolve(frame.result);
      } catch { return this.#fail("SEALBRIDGE_FRAME_INVALID"); }
    }
  }

  #fail(code) {
    const notify = !this.#failure && !this.#intentional;
    this.#failure ??= code;
    for (const { reject, timer } of this.#pending.values()) {
      clearTimeout(timer);
      reject(new SealbridgeError(this.#failure));
    }
    this.#pending.clear();
    if (notify) this.#options.onExit?.();
    this.#closing ??= this.#shutdown();
  }

  close() {
    this.#intentional = true;
    this.#closing ??= this.#shutdown();
    return this.#closing;
  }

  async #shutdown() {
    this.#failure ??= "SEALBRIDGE_HOST_CLOSED";
    for (const { reject, timer } of this.#pending.values()) {
      clearTimeout(timer);
      reject(new SealbridgeError(this.#failure));
    }
    this.#pending.clear();
    if (this.#child) {
      this.#child.stdin.end();
      const killTimer = setTimeout(() => this.#child.kill("SIGKILL"), this.#options.shutdownMs);
      try { await this.#closed; } finally { clearTimeout(killTimer); }
    }
    if (this.#home) await rm(this.#home, { recursive: true, force: true });
  }
}
