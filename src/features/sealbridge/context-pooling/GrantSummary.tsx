import type { ContextGrantSummary } from "../../../../shared/context-pooling";
import { copy, modes } from "../../../../shared/context-pooling-copy.json";

export function GrantSummary({ summary, beforeOpen = false, now = Date.now() }: {
  summary: ContextGrantSummary; beforeOpen?: boolean; now?: number;
}) {
  const mode = modes[summary.mode];
  const hours = Math.max(0, (Date.parse(summary.expiresAt) - now) / 3600000);
  return <section aria-label="grant 要約" className="space-y-2 rounded-lg border border-edge p-3" style={{ overflowWrap: "anywhere" }}>
    <span title={mode.supplement} className="rounded bg-panel px-2 py-1">{mode.badge}</span>
    <p>{mode.supplement}</p>
    <dl>
      <dt>観点</dt><dd>{summary.angle}</dd>
      <dt>範囲</dt><dd>列 {summary.allowedCount}件 · 拒否列 {summary.deniedCount}件（詳細は開く前はダイジェストのみ）</dd>
      <dt>期限</dt><dd>残り {Math.ceil(hours)}時間</dd>
      <dt>大きさ</dt><dd>{(summary.bytes / 1024).toFixed(2)} KB</dd>
      <dt>保持</dt><dd>{summary.retention === "input" ? "入力も可" : summary.retention === "deliverable" ? "納品のみ可" : "残さない"}</dd>
      <dt>ダイジェスト</dt><dd>{summary.digest}</dd>
    </dl>
    {hours <= 0 ? <p role="alert">{copy.expiredReceive}</p> : hours < 3 && <p>この切り出しの期限まで残り {Math.ceil(hours)}時間です</p>}
    <p>{mode.retention}</p>
    {beforeOpen && <><p>{copy.open}</p><p>{copy.limit}</p></>}
  </section>;
}
