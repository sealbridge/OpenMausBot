export function redactInviteText(value) {
  return String(value).replace(/(?:acp-invite(?::|%3a)|acp(?::|%3a)(?:\/\/|%2f%2f)invite|sealbridge(?::|%3a)(?:\/\/|%2f%2f))[^\s\x22'<>\\]*/gi, "[REDACTED]");
}
