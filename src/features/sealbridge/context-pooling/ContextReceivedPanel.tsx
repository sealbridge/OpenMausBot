import { useEffect, useState } from "react";
import type { ReceivedAuditRecord } from "../../../../shared/sealbridge";
import { modes } from "../../../../shared/context-pooling-copy.json";

export function ContextReceivedPanel() {
  const [rows, setRows] = useState<ReceivedAuditRecord[]>([]);
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState(false);
  const bridge = window.ogb?.sealbridge;
  useEffect(() => {
    if (!bridge?.receivedAudits) return;
    let active = true;
    const refresh = () => { void bridge.receivedAudits().then(value => { if (active) setRows(value); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [bridge]);
  const remove = (id: string) => {
    if (!bridge?.deleteReceivedAudit || busy) return;
    setBusy(true);
    void bridge.deleteReceivedAudit(id).then(result => {
      if (result.ok) setRows(current => current.filter(row => row.id !== id));
    }).finally(() => { setBusy(false); setPending(""); });
  };
  return <section aria-label="受け取ったもの" className="space-y-3">
    <h3>受け取ったもの</h3>
    <p>監査ファイルは自動では消えません。消すときは、依頼ごとに手で消してください。</p>
    {rows.length === 0 && <p>監査ファイルはまだありません。</p>}
    {rows.map(row => <article key={row.id} className="space-y-2 rounded border p-3">
      {!row.verified && <p role="status">確かめられません</p>}
      {row.verified && row.deliveryMode && <p>{modes[row.deliveryMode].badge}</p>}
      {row.verified && row.deliveryMode === "view_only" && row.outputRetained &&
        <p>閲覧のみでも、答えは監査の記録に残っています。</p>}
      {row.verified && row.deliveryMode === "hand_over" && row.deliverable !== undefined &&
        <pre className="whitespace-pre-wrap" aria-label="納品物">{row.deliverable}</pre>}
      {row.verified && row.outputRetained && <p>この記録には答えの中身が入っています</p>}
      <button type="button" disabled={busy} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
        onClick={() => setPending(row.id)}>この監査ファイルを消す</button>
      {pending === row.id && <div onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}>
        <p>この監査ファイルを消します</p>
        <button type="button" disabled={busy} onClick={() => remove(row.id)}>消す</button>
        <button type="button" disabled={busy} onClick={() => setPending("")}>やめる</button>
      </div>}
    </article>)}
  </section>;
}
