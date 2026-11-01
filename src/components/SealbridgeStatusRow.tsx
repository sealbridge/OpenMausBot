import { useEffect, useState } from "react";
import type { SealbridgeStatus } from "../../shared/sealbridge";
import { SettingRow } from "./SettingsPrimitives";

export function SealbridgeStatusRow() {
  const bridge = window.ogb?.sealbridge;
  const [status, setStatus] = useState<SealbridgeStatus>();
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const refresh = () => { void bridge.status().then(value => { if (active) setStatus(value); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [bridge]);
  if (!bridge) return null;
  const message = status?.state === "key-store-unavailable"
    ? "OSの鍵保管庫を利用できません。鍵保管庫を有効化・解錠してから再試行してください。"
    : status?.state === "ready" ? status.did
      : status?.state === "failed" ? "Sealbridgeを起動できません。再試行してください。"
        : "Sealbridgeを起動しています…";
  return <SettingRow title="Sealbridge" subtitle={message ?? undefined}>
    {(status?.state === "failed" || status?.state === "key-store-unavailable") &&
      <button className="ui-button" onClick={() => { void bridge.retry().then(setStatus).catch(() => {}); }}>再試行</button>}
  </SettingRow>;
}
