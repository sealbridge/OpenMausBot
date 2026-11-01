/** Public desktop core state. Secret keys and invitation credentials never cross this bridge. */
export interface SealbridgeStatus {
  state: "starting" | "ready" | "restarting" | "failed" | "key-store-unavailable" | "stopped";
  did: string | null;
  version: string | null;
}

/** Fixed local desktop actions; no arbitrary core methods or tool arguments are accepted. */
export interface SealbridgeBridge {
  status(): Promise<SealbridgeStatus>;
  retry(): Promise<SealbridgeStatus>;
}
