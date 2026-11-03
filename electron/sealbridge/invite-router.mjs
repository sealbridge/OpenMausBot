import { inviteErrorCode } from "./invite-errors.mjs";
import { createHash, randomUUID } from "node:crypto";

export function parseInviteLink(raw) {
  if (typeof raw !== "string" || raw.length > 70 * 1024 || /[\s\\]/.test(raw)) return null;
  const match = /^(?:sealbridge:\/\/invite|https:\/\/sealbridge\.app\/i)#(acp-invite:[A-Za-z0-9_-]{1,65536})$/.exec(raw);
  return match?.[1] ?? null;
}

export function createInviteQueue({ importInvite, maxEntries = 16 } = {}) {
  const seen = new Map(), fingerprints = new Map(), waiting = [], cards = new Map();
  let ready = false, draining, processing = 0;
  async function drain() {
    if (!ready) return;
    if (draining) return draining;
    draining = (async () => {
      while (ready && waiting.length) {
        const item = waiting.shift();
        processing++;
        try {
          const result = await importInvite(item.token);
          if (![...cards.values()].some(card => card.workerRef && card.workerRef === result.workerRef))
            cards.set(item.id, { id: item.id, ...result });
          else fingerprints.delete(item.id);
        } catch (error) {
          cards.set(item.id, { id: item.id, state: "error", code: inviteErrorCode(error) });
        } finally { item.token = undefined; processing--; }
      }
    })();
    try { await draining; } finally { draining = undefined; if (ready && waiting.length) void drain(); }
  }
  return {
    enqueue(raw) {
      const token = parseInviteLink(raw);
      if (!token) return false;
      const digest = createHash("sha256").update(token).digest("hex");
      const now = Date.now();
      for (const [key, expires] of seen) if (expires <= now && ![...fingerprints.values()].includes(key)) seen.delete(key);
      if (seen.has(digest)) return true;
      if (waiting.length + cards.size + processing >= maxEntries || seen.size >= 256) return false;
      seen.set(digest, now + 10 * 60 * 1000);
      const id = randomUUID();
      fingerprints.set(id, digest);
      waiting.push({ id, token });
      void drain();
      return true;
    },
    async setReady(value = true) { ready = value; await drain(); },
    list: () => [...cards.values()].map(card => ({ ...card })),
    get: id => cards.get(id),
    remove: id => {
      if (cards.get(id)?.state === "error") seen.delete(fingerprints.get(id));
      fingerprints.delete(id);
      return cards.delete(id);
    },
  };
}

export function captureInviteLinks({ app, queue, argv = process.argv, reveal = () => {} }) {
  const accept = raw => { const accepted = queue.enqueue(raw); if (accepted) reveal(); return accepted; };
  app.on("open-url", (event, raw) => { if (accept(raw)) event.preventDefault(); });
  const fromArgs = args => {
    for (let index = 0; index < args.length;) {
      if (!parseInviteLink(args[index])) { index++; continue; }
      const raw = args.splice(index, 1)[0];
      accept(raw);
    }
  };
  app.on("second-instance", (_event, args) => fromArgs(args));
  fromArgs(argv);
}
