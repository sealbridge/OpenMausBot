import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveCoreContext } from "./bootstrap.mjs";
import { publicInvite } from "./invite-public.mjs";

export async function createCoreInvites(options) {
  const { owner, identityOptions } = await resolveCoreContext(options);
  const load = name => import(pathToFileURL(path.join(options.packageDir, "dist", name)).href);
  const { InviteStore } = await load("packages/runtime/dist/invite-store.js");
  const store = await InviteStore.open(owner, identityOptions);
  return {
    import(token) {
      const existing = new Set(store.list().map(entry => entry.workerRef));
      const entry = store.import(token);
      return publicInvite({ ...entry, owned: !existing.has(entry.workerRef) });
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
