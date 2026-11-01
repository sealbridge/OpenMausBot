import { product } from "../../electron/sealbridge/product.mjs";

export function linuxPackageCuaDriverSource({ marker, state, wayland }) {
  return `#!${process.execPath}
const { appendFileSync, chmodSync, existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } = require("node:fs");
const net = require("node:net");
const marker = ${JSON.stringify(marker)};
const state = ${JSON.stringify(state)};
const wayland = ${JSON.stringify(wayland)};
const args = process.argv.slice(2);
appendFileSync(marker, JSON.stringify({
  pid: process.pid,
  args,
  telemetryEnabled: process.env.CUA_DRIVER_RS_TELEMETRY_ENABLED,
  updateCheck: process.env.CUA_DRIVER_RS_UPDATE_CHECK,
  waylandEnabled: process.env.CUA_DRIVER_RS_ENABLE_WAYLAND === "1",
}) + "\\n");
const after = (flag) => { const index = args.indexOf(flag); return index === -1 ? null : args[index + 1]; };
if (args.includes("--version")) {
  process.stdout.write("cua-driver 0.19.3\\n");
  process.exit(0);
}
if (args[0] === "manifest") {
  const binary = realpathSync(process.argv[1]);
  process.stdout.write(JSON.stringify({
    schema_version: "1",
    binary_version: "0.19.3",
    binary_path: binary,
    mcp_invocation: { command: binary, args: ["mcp"] },
  }) + "\\n");
  process.exit(0);
}
if (args[0] === "doctor" && args.includes("--json")) {
  process.stdout.write(JSON.stringify({ ok: true, probes: [
    { label: "binary", status: "ok", message: "cua-driver 0.19.3" },
    { label: "display server", status: "ok", message: wayland
      ? "Wayland+XWayland (WAYLAND_DISPLAY=wayland-smoke, DISPLAY=:99)"
      : "X11 (DISPLAY=:99)" },
    { label: "X11 connection", status: "warn", message: "no top-level windows in Xvfb" },
    { label: "AT-SPI", status: "ok", message: "fixture bus available" },
  ] }) + "\\n");
  process.exit(0);
}
if (args[0] !== "serve") process.exit(64);
const socketPath = after("--socket");
const pidFile = after("--pid-file");
if (!socketPath || !pidFile || !args.includes("--embedded") || !args.includes("--no-overlay") || after("--permission-mode") !== "standard") {
  process.exit(64);
}
if ((process.env.CUA_DRIVER_RS_ENABLE_WAYLAND === "1") !== wayland) process.exit(64);
const count = existsSync(state) ? Number(readFileSync(state, "utf8")) + 1 : 1;
writeFileSync(state, String(count));
writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
const metadata = {
  driver_version: "0.19.3",
  contract_version: "0.6.0",
  tools_list_schema_version: "1",
  capability_version: "1",
  mcp_protocol_version: "2025-06-18",
  pid: process.pid,
  embedded: true,
  host_bundle_id: ${JSON.stringify(product.appId)},
};
const tools = ["click", "get_window_state", "list_apps", "type_text"].map((name) => ({ name }));
const toolManifest = { schema_version: "1", capability_version: "1", tools };
const healthReport = {
  schema_version: "1",
  platform: "linux",
  driver_version: "0.19.3",
  overall: "ok",
  checks: [
    { name: "binary_version", status: "pass", message: "cua-driver 0.19.3" },
    { name: "platform_supported", status: "pass", message: "Ubuntu 24.04" },
    { name: "session_active", status: "pass", message: "MCP session is active." },
    { name: "ax_capability", status: "pass", message: "AT-SPI fixture is reachable." },
    { name: "screen_capture_capability", status: "pass", message: "Portal fixture is reachable." },
    { name: "wayland_backend", status: "pass", message: "WinRects and portal/libei fixtures are reachable." },
  ],
};
const server = net.createServer((socket) => {
  let input = "";
  socket.on("data", (chunk) => {
    input += chunk;
    const newline = input.indexOf("\\n");
    if (newline === -1) return;
    const request = JSON.parse(input.slice(0, newline));
    const result = request.method === "metadata"
      ? metadata
      : request.method === "list"
        ? toolManifest
        : request.method === "call" && request.name === "health_report" && wayland
          ? { structuredContent: healthReport }
          : null;
    socket.end(JSON.stringify(result ? { ok: true, result } : { ok: false, error: "unknown" }) + "\\n");
    if (count === 1 && request.method === "list") setTimeout(() => server.close(() => process.exit(17)), 5000);
  });
});
server.listen(socketPath, () => chmodSync(socketPath, 0o600));
const shutdown = () => server.close(() => {
  for (const file of [socketPath, pidFile]) { try { unlinkSync(file); } catch {} }
  process.exit(0);
});
process.stdin.on("end", shutdown);
process.on("SIGTERM", shutdown);
`;
}
