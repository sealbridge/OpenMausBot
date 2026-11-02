const codes = new Set(["INVITE_EXPIRED", "INVALID_OR_EXPIRED_INVITE", "INVALID_INVITE_LINK",
  "SELF_DELEGATION_NOT_ALLOWED", "ALIAS_EXISTS", "INVITE_STORE_BUSY", "KEY_STORE_UNAVAILABLE",
  "INVITE_SECRET_DELETE_FAILED", "MCP_RELAY_NOT_ALLOWED", "RELAY_NOT_ALLOWED", "SSRF_BLOCKED_RELAY_URL"]);

export function inviteErrorCode(error) {
  const code = typeof error?.message === "string" ? error.message : error?.error;
  return codes.has(code) ? code : "INVITE_OPERATION_FAILED";
}
