import type { ContextSelectionDraft, ContextPreparation } from "./context-pooling";

/** Public desktop core state. Secret keys and invitation credentials never cross this bridge. */
export interface SealbridgeStatus {
  state: "starting" | "ready" | "restarting" | "failed" | "key-store-unavailable" | "stopped";
  did: string | null;
  version: string | null;
}

/** Fixed local desktop actions; no arbitrary core methods or tool arguments are accepted. */
export interface SealbridgeBridge {
  contextRecipients(): Promise<ContextRecipient[]>;
  startContext(id: string, draft: ContextSelectionDraft): Promise<{ ok: boolean }>;
  contextStatus(): Promise<ContextSendStatus>;
  answerContext(id: number, accept: boolean): Promise<{ ok: boolean }>;
  cancelContext(): Promise<{ ok: boolean }>;
  resetContext(): Promise<void>;
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

/** Display-only connected target; id resolves to routing data in main. */
export interface ContextRecipient { id: string; name: string; did: string; state: "connected" }
/** Transient send state and the SDK approval request projection. */
export interface ContextSendStatus {
  state: string;
  peerRejected?: boolean;
  deliverable?: string;
  approval?: { id: number; gate: string; recipient: string; mode: string; angle: string;
    allowedCount: number; deniedCount: number; bytes: number; expiresAt: string; digest: string; deliverable?: string; deliverableDigest?: string };
}
