import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { product } from "../../electron/sealbridge/product.mjs";
import { linuxPackageCuaDriverSource } from "./linux-package-cua-driver.mjs";

const require = createRequire(import.meta.url);
const { probePrivateDaemon } = require("../../electron/cua-linux-runtime.cjs");

describe("Linux package smoke driver", () => {
  it("answers the production handshake with the branded host identity in an isolated child scope", async () => {
    const sandbox = fs.mkdtempSync(path.join(tmpdir(), "omb-smoke-driver-"));
    const directory = path.join(sandbox, product.productName);
    fs.mkdirSync(directory, { mode: 0o700 });
    const driver = path.join(directory, "cua-driver.cjs");
    const marker = path.join(directory, "invocations.ndjson");
    const state = path.join(directory, "serve-count");
    const socketPath = path.join(directory, "driver.sock");
    const pidFile = path.join(directory, "driver.pid");
    const childPid = 4321;
    const listen = vi.fn();
    const createServer = vi.fn(() => ({ listen }));
    const request = async (_socketPath, message) => {
      const socket = new EventEmitter();
      let response;
      socket.end = (line) => { response = JSON.parse(line); };
      createServer.mock.calls[0][0](socket);
      socket.emit("data", `${JSON.stringify(message)}\n`);
      return response;
    };
    try {
      const source = linuxPackageCuaDriverSource({ marker, state, wayland: false });
      runInNewContext(source, {
        require: (name) => {
          if (name === "node:fs") return fs;
          if (name === "node:net") return { createServer };
          throw new Error(`Unexpected driver import: ${name}`);
        },
        process: {
          argv: [process.execPath, driver, "serve", "--embedded", "--no-overlay",
            "--socket", socketPath, "--pid-file", pidFile, "--permission-mode", "standard"],
          pid: childPid,
          env: {},
          stdin: new EventEmitter(),
          on: vi.fn(),
        },
        setTimeout: vi.fn(),
      });
      expect(listen).toHaveBeenCalledWith(socketPath, expect.any(Function));
      const handshake = await probePrivateDaemon(socketPath, { childPid, request });
      expect(handshake.metadata.host_bundle_id).toBe(product.appId);
      expect(handshake.tools).toEqual(["click", "get_window_state", "list_apps", "type_text"]);
      expect(fs.readFileSync(state, "utf8")).toBe("1");
      expect(Number(fs.readFileSync(pidFile, "utf8"))).toBe(childPid);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
