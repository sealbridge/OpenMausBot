import { useEffect, useState } from "react";
import type { ContextReceiveStatus } from "../../../../shared/sealbridge";
import type { ContextGrantSummary } from "../../../../shared/context-pooling";
import { GrantSummary } from "./GrantSummary";

function Reply({ id, summary, sent }: { id: number; summary?: ContextGrantSummary; sent: () => void }) {
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const bytes = new TextEncoder().encode(body).length;
  return <section aria-label="手で答える" className="space-y-2">
    <label>答え<textarea className="ui-input block w-full" spellCheck={false} autoComplete="off" value={body}
      disabled={busy} onChange={event => { setBody(event.target.value); setConfirmed(false); }} /></label>
    <button type="button" disabled={!body.trim() || bytes > 65536 || busy} onClick={() => setConfirmed(true)}>答えを確認</button>
    {confirmed && <section aria-label="この答えを送ります" onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}>
      <p>この答えを送ります</p>
      {summary && <GrantSummary summary={{ ...summary, bytes }} />}
      <p>答えの大きさ: {bytes} バイト</p><pre className="whitespace-pre-wrap">{body}</pre>
      <button type="button" disabled={busy} onClick={() => {
        const bridge = window.ogb?.sealbridge;
        if (!bridge) return;
        setBusy(true);
        void bridge.receiveReply(id, body).then(result => { if (result.ok) { setBody(""); sent(); } })
          .finally(() => setBusy(false));
      }}>この答えを送る</button>
      <button type="button" disabled={busy} onClick={() => setConfirmed(false)}>書き直す</button>
    </section>}
  </section>;
}

export function ContextReceivePanel() {
  const [status, setStatus] = useState<ContextReceiveStatus>({ state: "idle", rows: [], compose: [], rejected: [] });
  const bridge = window.ogb?.sealbridge;
  useEffect(() => {
    if (!bridge?.receiveStatus) return;
    let active = true;
    const refresh = () => { void bridge.receiveStatus().then(value => { if (active) setStatus(value); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 500);
    return () => { active = false; clearInterval(timer); };
  }, [bridge]);
  return <section aria-label="受信箱" className="space-y-3">
    <h3>受信箱</h3>
    <p>相手が待っている間だけ開けます（既定10分）。過ぎたら送り直しが必要です。閉じると止まります。</p>
    {status.state === "failed" && <p role="alert">受信を開始できませんでした。</p>}
    {status.rows.map(row => <article key={row.id} className="space-y-2 rounded border p-3">
      <p>{row.sender}</p>
      <p>{row.state === "expired" ? "期限切れ" : row.inspectionStatus === "pending" ? "隔離中・検査中" :
        row.inspectionStatus === "complete" ? "判断待ち（検査完了）" :
          "検査できませんでした。この依頼は保留です。中身は読めますが、答えるには相手の送り直しが要ります"}</p>
      {row.inspection && <><p>ルール検査: {row.inspection.verdict}</p>
        {row.inspection.findings.map((finding, index) => <p key={index}>{finding.ruleId} · {finding.severity} · {finding.noteCode}</p>)}</>}
      {row.summary && <GrantSummary summary={row.summary} beforeOpen />}
      {row.preview !== undefined && <pre className="whitespace-pre-wrap" aria-label="本文プレビュー">{row.preview}</pre>}
      <button type="button" disabled={!row.canOpen || row.inspectionStatus !== "complete" || row.state !== "reviewable"}
        onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
        onClick={() => { void bridge?.receiveAction(row.id, "open"); }}>開く</button>
      <button type="button" onClick={() => { void bridge?.receiveAction(row.id, "discard"); }}>捨てる</button>
    </article>)}
    {status.compose.map(item => <Reply key={item.id} {...item} sent={() => setStatus(value => ({ ...value, compose: value.compose.filter(row => row.id !== item.id) }))} />)}
    {status.rejected.map((item, index) => <p key={index} role="status">依頼は断られました: {item.code}</p>)}
  </section>;
}
