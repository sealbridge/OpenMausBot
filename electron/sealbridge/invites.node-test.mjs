import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInviteQueue, captureInviteLinks, parseInviteLink } from "./invite-router.mjs";
import { createDesktopInvites, registerInviteIpc } from "./invites.mjs";
import { createInviteProcess } from "./invite-process.mjs";
import { revealLinkWindow } from "./link-window.mjs";
import { redact } from "./redaction.mjs";
import { formatDesktopCrashRecord, redactSecretsInLine } from "../diagnostics.mjs";
import { McpHost } from "./mcp-host.mjs";

const token = "acp-invite:G4_DUMMY_SECRET_NEVER_IN_MCP_IPC_LOGS";
const link = "sealbridge://invite#" + token;
const saved = { workerRef: "saved:" + "a".repeat(64), alias: "fixture", ownerDid: "did:key:z" + "A".repeat(48),
  effectiveExpiresAt: "2099-01-01T00:00:00.000Z", displayName: "Fixture", owned: true };
const card = { ...saved, peerDid: "did:key:zAAAA…AAAA", expiresAt: saved.effectiveExpiresAt, state: "pending" };

async function temporary(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "sealbridge-g4-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("strict custom and official HTTPS invitations reject ambiguous or extra URL components", () => {
  assert.equal(parseInviteLink(link), token);
  assert.equal(parseInviteLink("https://sealbridge.app/i#" + token), token);
  for (const raw of [null, {}, "", token, link + "?x=1", link + "#x", link + "\n", " " + link,
    "sealbridge://invite/allowed#" + token, "sealbridge://invite/#" + token, "sealbridge://invite?x=1#" + token,
    "sealbridge://user@invite#" + token, "sealbridge://invite:1#" + token, "sealbridge://%69nvite#" + token,
    "sealbridge://invite#" + encodeURIComponent(token), "https://evil.test/i#" + token,
    "https://sealbridge.app:443/i#" + token, "https://sealbridge.app/i?x#" + token, link + "a".repeat(70000)]) {
    assert.equal(parseInviteLink(raw), null);
  }
});

test("cold argv, macOS open-url and Windows/Linux second-instance queue in order exactly once before ready", async () => {
  const imported = [], app = new EventEmitter();
  const queue = createInviteQueue({ importInvite: async value => { imported.push(value); return { ...card, workerRef: saved.workerRef + imported.length }; } });
  const argv = ["fixture.exe", link];
  captureInviteLinks({ app, queue, argv });
  assert.deepEqual(argv, ["fixture.exe"]);
  let prevented = 0;
  app.emit("open-url", { preventDefault() { prevented++; } }, link);
  app.emit("second-instance", {}, ["fixture", link, link + "2"]);
  app.emit("open-url", { preventDefault() { prevented++; } }, link + "3");
  assert.equal(prevented, 2);
  assert.deepEqual(imported, []);
  await queue.setReady();
  await queue.setReady();
  assert.deepEqual(imported, [token, token + "2", token + "3"]);
  assert.equal(queue.list().length, 3);
  assert.ok(!JSON.stringify(queue.list()).includes(token));
});

test("queue bounds pending invitations and isolates import failures without echoing secrets", async () => {
  const queue = createInviteQueue({ maxEntries: 2, importInvite: async () => { throw new Error(token); } });
  assert.ok(queue.enqueue(link)); assert.ok(queue.enqueue(link)); assert.ok(queue.enqueue(link + "2"));
  assert.equal(queue.enqueue(link + "3"), false);
  await queue.setReady();
  assert.deepEqual(queue.list().map(c => c.code), ["INVITE_OPERATION_FAILED", "INVITE_OPERATION_FAILED"]);
  assert.ok(!JSON.stringify(queue.list()).includes(token));
});

test("local-only IPC returns only public previews; confirmation and cancellation use saved references", async () => {
  const invites = createDesktopInvites(), calls = [], handlers = new Map();
  invites.enqueue(link);
  await invites.ready(async (action, value) => { calls.push([action, value]); return action === "remove" ? { removed: true } : card; });
  registerInviteIpc({ invites, clipboard: { readText: () => link }, ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    localOnly: (_name, fn) => (event, ...args) => { if (!event.local) throw new Error("LOCAL_ONLY"); return fn(event, ...args); } });
  for (const fn of handlers.values()) assert.throws(() => fn({ local: false }), /LOCAL_ONLY/);
  const previews = handlers.get("sealbridge:invites")({ local: true });
  assert.deepEqual(Object.keys(previews[0]).sort(), ["code", "displayName", "expiresAt", "id", "peerDid", "state", "warnings"]);
  assert.ok(!JSON.stringify(previews).includes(token));
  assert.equal(calls.length, 1);
  assert.equal((await invites.decide(previews[0].id, "trusted")).ok, false);
  assert.equal((await invites.decide(previews[0].id, "confirm")).ok, true);
  assert.deepEqual(calls[1], ["confirm", saved.workerRef]);
  assert.deepEqual(invites.list(), []);
  invites.enqueue(link + "2"); await invites.ready(async (action, value) => { calls.push([action, value]); return action === "remove" ? { removed: true } : card; });
  const id = invites.list()[0].id;
  await invites.decide(id, "cancel");
  assert.deepEqual(calls.at(-1), ["remove", saved.workerRef]);
  assert.equal((await invites.decide(id, "cancel")).ok, false);
});

test("cancel preserves invitations that existed before this preview; failures retain a retryable decision", async () => {
  const invites = createDesktopInvites(), calls = [];
  invites.enqueue(link);
  await invites.ready(async (action, value) => { calls.push([action, value]); return { ...card, owned: false }; });
  assert.ok((await invites.decide(invites.list()[0].id, "cancel")).ok);
  assert.equal(calls.length, 1);
  const failed = createDesktopInvites();
  failed.enqueue(link + "2");
  await failed.ready(async action => { if (action === "import") return card; throw new Error(token); });
  const id = failed.list()[0].id;
  assert.deepEqual(await failed.decide(id, "cancel"), { ok: false });
  assert.equal(failed.list().length, 1);
  assert.ok(!JSON.stringify(invites.list()).includes(token));
});

test("dedicated child receives token only via stdin, strips stderr and errors and whitelists public output", async t => {
  const dir = await temporary(t);
  const script = `import fs from 'node:fs';
const chunks=[]; for await (const c of process.stdin) chunks.push(c);
const token=Buffer.concat(chunks).toString();
fs.writeFileSync(${JSON.stringify(path.join(dir, "capture.json"))}, JSON.stringify({argv:process.argv,env:process.env,stdin:token}));
process.stderr.write(token);
process.stdout.write(JSON.stringify({...${JSON.stringify(saved)},displayName:token,unexpected:token}));`;
  await writeFile(path.join(dir, "invite-child.mjs"), script);
  const operate = createInviteProcess({ runtimeDir: dir, dataDir: dir });
  const result = await operate("import", token);
  const captured = JSON.parse(await readFile(path.join(dir, "capture.json"), "utf8"));
  assert.equal(captured.stdin, token);
  assert.ok(!JSON.stringify([captured.argv, captured.env, result]).includes(token));
  assert.equal(result.displayName, "[REDACTED]");
  await writeFile(path.join(dir, "invite-child.mjs"), `process.stderr.write(${JSON.stringify(token)}); throw new Error(${JSON.stringify(token)});`);
  await assert.rejects(operate("import", token), error => !String(error).includes(token));
});

test("captured MCP input frames and host diagnostics never receive invitation credentials", async t => {
  const dir = await temporary(t), frames = path.join(dir, "frames.jsonl"), cliEntry = path.join(dir, "mcp.mjs");
  await writeFile(cliEntry, `import fs from 'node:fs'; import readline from 'node:readline';
for await (const line of readline.createInterface({input:process.stdin})) {
fs.appendFileSync(${JSON.stringify(frames)},line+'\\n'); const f=JSON.parse(line); if(!f.id) continue;
const result=f.method==='initialize'?{protocolVersion:'2024-11-05',serverInfo:{version:'0.2.2'}}:f.method==='tools/list'?{tools:[]}:{};
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:f.id,result})+'\\n');
}`);
  const host = new McpHost({ cliEntry }); t.after(() => host.close());
  await host.start();
  await assert.rejects(host.callTool("anything", { value: token }));
  await assert.rejects(host.callTool("anything", { inviteToken: token }));
  await host.callTool("acp_remove_invite", { workerRef: saved.workerRef });
  await host.close();
  const logs = [formatDesktopCrashRecord({ kind: "main", error: new Error(token), origin: token }), host.stderr, redact(token), redact(link), redactSecretsInLine(token), redactSecretsInLine(link), redactSecretsInLine(encodeURIComponent(link))];
  assert.ok(!JSON.stringify(logs).includes("G4_DUMMY_SECRET"));
  assert.ok(!(await readFile(frames, "utf8")).includes(token));
});

test("invitation modules expose no listening socket or external IPC server", async () => {
  for (const name of ["invite-router", "invites", "invite-process", "invite-child", "core-invites", "invite-public"]) {
    assert.doesNotMatch(await readFile(new URL(`./${name}.mjs`, import.meta.url), "utf8"), /\b(?:listen|createServer)\s*\(|node:(?:net|http|https)/);
  }
});


test("import errors cross the boundary only as allowlisted codes", async () => {
  const queue = createInviteQueue({ importInvite: async () => { throw new Error("INVITE_EXPIRED"); } });
  queue.enqueue(link); await queue.setReady();
  assert.equal(queue.list()[0].code, "INVITE_EXPIRED");
});

test("missing metadata closes cancellation with an incomplete deletion warning", async () => {
  const invites = createDesktopInvites();
  invites.enqueue(link);
  await invites.ready(async action => action === "import" ? card : { removed: false });
  assert.deepEqual(await invites.decide(invites.list()[0].id, "cancel"), { ok: true, state: "cancelled-incomplete" });
  assert.equal(invites.list().length, 0);
});


test("partial removal publishes metadata first, then retries without claiming secret deletion", async () => {
  const invites = createDesktopInvites();
  let metadata = true, secret = true, removals = 0;
  invites.enqueue(link);
  await invites.ready(async action => {
    if (action === "import") return card;
    removals++;
    if (!metadata) return { removed: false };
    metadata = false;
    if (secret) throw new Error("INVITE_SECRET_DELETE_FAILED");
    return { removed: true };
  });
  const id = invites.list()[0].id;
  assert.deepEqual(await invites.decide(id, "cancel"), { ok: false });
  assert.equal(metadata, false);
  assert.equal(secret, true);
  assert.equal(invites.list().length, 1);
  assert.deepEqual(await invites.decide(id, "cancel"), { ok: true, state: "cancelled-incomplete" });
  assert.equal(invites.list().length, 0);
  assert.equal(removals, 2);
});

test("closing failed imports permits retry while successful imports stay deduplicated", async () => {
  let attempts = 0;
  const queue = createInviteQueue({ importInvite: async () => {
    if (++attempts === 1) throw new Error("KEY_STORE_UNAVAILABLE");
    return card;
  } });
  queue.enqueue(link); await queue.setReady();
  queue.remove(queue.list()[0].id);
  queue.enqueue(link); await queue.setReady();
  assert.equal(attempts, 2);
  assert.equal(queue.list()[0].state, "pending");
  queue.remove(queue.list()[0].id);
  queue.enqueue(link); await queue.setReady();
  assert.equal(attempts, 2);
});


test("open-url and second-instance reveal through the window creation path when all windows are closed", async () => {
  for (const event of ["open-url", "second-instance"]) {
    const app = new EventEmitter(), windows = [];
    let opened = 0;
    const queue = createInviteQueue({ importInvite: async () => card });
    const reveal = () => revealLinkWindow({ tray: () => null, windows: () => windows,
      activate: current => current.length > 0, open: () => { opened++; windows.push({}); } });
    captureInviteLinks({ app, queue, argv: [], reveal });
    if (event === "open-url") app.emit(event, { preventDefault() {} }, link);
    else app.emit(event, {}, ["fixture", link]);
    await queue.setReady();
    assert.equal(opened, 1);
    assert.equal(queue.list()[0].state, "pending");
    reveal();
    assert.equal(opened, 1);
  }
  const main = await readFile(new URL("../main.mjs", import.meta.url), "utf8");
  assert.match(main, /setInviteReveal\(revealForLink\)/);
  assert.match(main, /openWindowForLink = \(\) =>/);
});
