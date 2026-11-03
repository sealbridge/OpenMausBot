import { createInviteQueue, captureInviteLinks } from "./invite-router.mjs";

export function createDesktopInvites() {
  let operate, busy = false;
  const queue = createInviteQueue({ importInvite: token => operate("import", token) });
  return {
    enqueue: raw => queue.enqueue(raw),
    capture: options => captureInviteLinks({ ...options, queue }),
    async ready(operation) { operate = operation; await queue.setReady(); },
    pause: () => queue.setReady(false),
    list: () => queue.list().map(({ id, state, code, displayName, peerDid, expiresAt, warnings }) =>
      ({ id, state, code, displayName, peerDid, expiresAt, warnings })),
    async decide(id, decision) {
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || !["confirm", "cancel"].includes(decision) || busy) return { ok: false };
      const card = queue.get(id);
      if (!card) return { ok: false };
      if (card.state === "error") { if (decision === "cancel") queue.remove(id); return { ok: decision === "cancel" }; }
      if (card.state !== "pending") return { ok: false };
      busy = true;
      try {
        if (decision === "confirm") {
          if (Date.parse(card.expiresAt) <= Date.now()) return { ok: false };
          await operate("confirm", card.workerRef);
        } else if (card.owned) {
          const result = await operate("remove", card.workerRef);
          if (!result.removed) {
            queue.remove(id);
            return { ok: true, state: "cancelled-incomplete" };
          }
        }
        queue.remove(id);
        return { ok: true, state: decision === "confirm" ? "pending-connection" : "cancelled" };
      } catch { return { ok: false }; }
      finally { busy = false; }
    },
  };
}

export const desktopInvites = createDesktopInvites();

export function registerInviteIpc({ ipcMain, localOnly, invites = desktopInvites, clipboard }) {
  ipcMain.handle("sealbridge:invites", localOnly("sealbridge:invites", () => invites.list()));
  ipcMain.handle("sealbridge:invite-decision", localOnly("sealbridge:invite-decision", (_event, id, decision) => invites.decide(id, decision)));
  ipcMain.handle("sealbridge:invite-paste", localOnly("sealbridge:invite-paste", () => {
    const raw = clipboard.readText();
    return { ok: invites.enqueue(raw) };
  }));
}
