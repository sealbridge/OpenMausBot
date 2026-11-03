import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCoreContext } from "./bootstrap.mjs";
import { publicInvite } from "./invite-public.mjs";

export async function createCoreInvites(options) {
  const { owner, identityOptions } = await resolveCoreContext(options);
  const load = name => import(pathToFileURL(path.join(options.packageDir, "dist", name)).href);
  const { InviteStore } = await load("packages/runtime/dist/invite-store.js");
  const { WorkerTrustStore, workerIntakePath } = await load("packages/runtime/dist/index.js");
  const trust = new WorkerTrustStore(owner, { path: workerIntakePath(owner.did, identityOptions) });
  const store = await InviteStore.open(owner, identityOptions);
  return {
    import(token) {
      const known = store.list();
      const connections = trust.listConnections();
      const existing = new Set(known.map(entry => entry.workerRef));
      const entry = store.import(token);
      const warnings = [];
      if (known.some(peer => peer.displayName === entry.displayName && peer.ownerDid !== entry.ownerDid))
        warnings.push("same-name-different-did");
      if (known.some(peer => peer.ownerDid === entry.ownerDid &&
          (peer.agentDid !== entry.agentDid || peer.displayName !== entry.displayName)) ||
          connections.some(peer => peer.peerOwnerDid === entry.ownerDid && peer.peerAgentDid && peer.peerAgentDid !== entry.agentDid))
        warnings.push("identity-changed");
      return publicInvite({ ...entry, warnings, owned: !existing.has(entry.workerRef) });
    },
    remove: ref => ({ removed: store.remove(ref) }),
    async confirm(ref) {
      const { connectionsCommand } = await load("cli/dist/connections.js");
      await connectionsCommand(["confirm-invite", ref], { ...options.connectionOptions, identityOptions,
        review: async () => true, output: () => {} });
      return { state: "pending-connection" };
    },
  };
}
