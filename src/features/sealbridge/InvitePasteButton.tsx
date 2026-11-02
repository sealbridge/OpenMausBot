import { useState } from "react";

export function InvitePasteButton() {
  const bridge = window.ogb?.sealbridge;
  const [message, setMessage] = useState("");
  if (!bridge?.pasteInvite) return null;
  return <div className="px-3 py-1">
    <button className="ui-button text-xs" title="コピーした招待リンクを読み取ります" onClick={() => {
      void bridge.pasteInvite().then(result => setMessage(result.ok ? "招待を確認しています…"
        : "Sealbridgeの招待リンクではありません。または保留件数が上限に達しています。"))
        .catch(() => setMessage("招待を読み取れませんでした。"));
    }}>招待リンクを取り込む</button>
    {message && <p role="status" className="text-xs text-ink-secondary">{message}</p>}
  </div>;
}
