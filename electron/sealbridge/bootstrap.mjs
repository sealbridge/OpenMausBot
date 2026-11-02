import path from "node:path";
import { pathToFileURL } from "node:url";

export async function resolveCoreContext({ packageDir, dataDir, keyringLoader }) {
  if (!path.isAbsolute(dataDir ?? "")) throw new Error("DATA_DIR_UNAVAILABLE");
  const load = name => import(pathToFileURL(path.join(packageDir, "dist/packages/runtime/dist", name + ".js")).href);
  const { resolveStoredIdentity, selectKeyStore } = await load("key-store");
  const { setApplicationKeyStore } = await load("application-config");
  const identityOptions = { env: { SEALBRIDGE_DATA_DIR: dataDir }, keyStore: "keychain", keyringLoader };
  await (await selectKeyStore("requester", identityOptions)).exists("requester");
  setApplicationKeyStore("keychain", identityOptions);
  const owner = await resolveStoredIdentity("requester", identityOptions);
  return { owner, identityOptions, load };
}

export async function bootstrapCore(options) {
  const { owner, identityOptions, load } = await resolveCoreContext(options);
  const { AcpMcpServer } = await load("mcp-server");
  const server = new AcpMcpServer({ identityOptions, owner, requireInteractiveApproval: true });
  return { did: owner.did, server };
}
