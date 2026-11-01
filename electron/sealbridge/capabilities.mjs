import { publicString } from "./redaction.mjs";

export function negotiateCapabilities(initialize = {}, catalog = {}) {
  initialize = initialize && typeof initialize === "object" ? initialize : {};
  catalog = catalog && typeof catalog === "object" ? catalog : {};
  const tools = Object.freeze([...new Set((Array.isArray(catalog.tools) ? catalog.tools : [])
    .map(tool => tool?.name).filter(name => typeof name === "string" && /^acp_[a-z_]+$/.test(name)))].sort());
  const has = name => tools.includes(name);
  // These extension signals are provisional until the core team publishes its contract.
  const extension = initialize.capabilities?.experimental?.sealbridge;
  const hostApproval = extension?.hostApproval === true && extension?.elicitation === true;
  return Object.freeze({
    serverVersion: publicString(initialize.serverInfo?.version, 64) ?? null,
    protocolVersion: publicString(initialize.protocolVersion, 64) ?? null,
    tools,
    features: Object.freeze({
      delegate: has("acp_delegate_task"),
      delegateMulti: has("acp_delegate_multi"),
      discover: has("acp_discover_workers"),
      inviteAliases: has("acp_list_invites"),
      hostApproval,
      openWorkerDiscovery: has("acp_discover_workers") && extension?.openWorkerDiscovery === true,
      identityBootstrap: extension?.identityBootstrap === true,
      inviteImport: has("acp_list_invites") && extension?.inviteImport === true,
      relayAuthRecovery: extension?.relayAuthRecovery === true,
      requestStatus: extension?.requestStatus === true,
      requestCancellation: extension?.requestCancellation === true,
    }),
  });
}
