import type { ContextSelectionDraft, ContextPreparation } from "./context-pooling";

/** Public desktop core state. Secret keys and invitation credentials never cross this bridge. */
export interface SealbridgeStatus {
  state: "starting" | "ready" | "restarting" | "failed" | "key-store-unavailable" | "stopped";
  did: string | null;
  version: string | null;
}

/** Fixed local desktop actions; no arbitrary core methods or tool arguments are accepted. */
export interface SealbridgeBridge {
  prepareContext(draft: ContextSelectionDraft): Promise<ContextPreparation>;
  invites(): Promise<SealbridgeInvite[]>;
  inviteDecision(id: string, decision: "confirm" | "cancel"): Promise<{ ok: boolean; state?: string }>;
  pasteInvite(): Promise<{ ok: boolean }>;
  status(): Promise<SealbridgeStatus>;
  retry(): Promise<SealbridgeStatus>;
}

/** Token-free invitation preview. The id identifies a pending desktop decision. */
export interface SealbridgeInvite {
  id: string;
  state: "pending" | "error";
  code?: string;
  displayName?: string;
  peerDid?: string;
  expiresAt?: string;
  warnings?: ("same-name-different-did" | "identity-changed")[];
}
