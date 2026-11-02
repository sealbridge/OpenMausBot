import { inviteErrorCode } from "./invite-errors.mjs";
import { spawn } from "node:child_process";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { sanitizedEnvironment } from "./mcp-host.mjs";
import { publicInvite } from "./invite-public.mjs";

export function createInviteProcess({ runtimeDir, dataDir, nodeBinary = process.execPath }) {
  return async (action, value) => {
    const home = await mkdtemp(path.join(tmpdir(), "sealbridge-invite-"));
    try {
      return await new Promise((resolve, reject) => {
        let output = Buffer.alloc(0), failed = false;
        const child = spawn(nodeBinary, [path.join(runtimeDir, "invite-child.mjs"), action,
          ...(action === "import" ? [] : [value])], { shell: false, windowsHide: true, cwd: home,
          env: { ...sanitizedEnvironment(process.env, home), SEALBRIDGE_DATA_DIR: dataDir }, stdio: ["pipe", "pipe", "pipe"] });
        const fail = () => { failed = true; child.kill("SIGKILL"); };
        const timer = setTimeout(fail, 30000);
        child.once("error", fail);
        child.stdin.on("error", fail);
        child.stderr.on("data", () => {});
        child.stdout.on("data", chunk => {
          if (output.length + chunk.length > 8192) fail();
          else output = Buffer.concat([output, chunk]);
        });
        child.once("close", code => {
          clearTimeout(timer);
          if (failed) { reject(new Error("INVITE_OPERATION_FAILED")); return; }
          try {
            const result = JSON.parse(output.toString("utf8"));
            if (code !== 0) { reject(new Error(inviteErrorCode(result))); return; }
            resolve(action === "import" ? publicInvite(result) : action === "remove"
              ? { removed: result.removed === true } : { state: "pending-connection" });
          } catch { reject(new Error("INVITE_OPERATION_FAILED")); }
        });
        child.stdin.end(action === "import" ? value : "");
      });
    } finally { await rm(home, { recursive: true, force: true }); }
  };
}
