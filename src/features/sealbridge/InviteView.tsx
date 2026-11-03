import { useEffect, useRef, useState } from "react";
import type { SealbridgeInvite } from "../../../shared/sealbridge";

export function InviteView() {
  const bridge = window.ogb?.sealbridge;
  const [invites, setInvites] = useState<SealbridgeInvite[]>([]);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!bridge?.invites) return;
    let active = true;
    const refresh = () => { void bridge.invites().then(value => { if (active) setInvites(value); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => { active = false; clearInterval(timer); };
  }, [bridge]);
  const card = invites[0];
  useEffect(() => {
    if (!card) return;
    const previous = document.activeElement;
    cancelRef.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [card?.id]);
  if (!bridge?.invites) return null;
  const decide = async (decision: "confirm" | "cancel") => {
    if (!card || busy) return;
    if (decision === "confirm" && card.warnings?.length && acknowledged !== card.id) return;
    setBusy(true);
    try {
      const result = await bridge.inviteDecision(card.id, decision);
      if (result.ok) {
        setInvites(previous => previous.filter(item => item.id !== card.id));
        setMessage(decision === "confirm" ? "接続の確認を送りました。相手からの応答を待っています。" : result.state === "cancelled-incomplete" ? "保管庫から完全に削除できなかった可能性があります。" : "招待を閉じました。");
      } else setMessage("処理できませんでした。鍵保管庫や接続を確認し、再試行してください。");
    } catch { setMessage("処理できませんでした。再試行してください。"); }
    finally { setBusy(false); }
  };
  return <>
    {message && <p role="status" className="fixed bottom-4 right-4 z-50 rounded-lg bg-panel p-3 text-ink">{message}</p>}
    {card && <section ref={dialogRef} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); void decide("cancel"); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} role="dialog" aria-modal="true" aria-label="接続の招待" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-xl bg-panel p-6 text-ink max-w-lg" style={{ overflowWrap: "anywhere" }}>
        {card.state === "error" ? <p>{card.code === "INVITE_EXPIRED" ? "この招待は期限切れです。送り主に新しい招待リンクをリクエストしてください。"
          : card.code === "SELF_DELEGATION_NOT_ALLOWED" ? "自分の招待は受け入れられません。"
            : card.code === "KEY_STORE_UNAVAILABLE" ? "OSの鍵保管庫を利用できません。解錠してから再試行してください。"
              : "招待を確認できません。署名・期限・接続先を確認し、新しいリンクでお試しください。"}</p> : <>
          <h2>{card.displayName} から接続の招待です</h2>
          {!!card.warnings?.length && <div role="alert" className="border border-red-600 p-3">
            {card.warnings.includes("same-name-different-did") && <p>同じ名前の別の相手がすでにいます。DIDを確認してください。</p>}
            {card.warnings.includes("identity-changed") && <p>以前と異なる識別情報です。相手に確認してください。</p>}
            <button className="ui-button" disabled={busy || acknowledged === card.id} onClick={() => setAcknowledged(card.id)}>警告を確認しました</button>
          </div>}
          <p>相手のDID: {card.peerDid}</p>
          <p>この招待は {card.expiresAt} まで有効です。</p>
          <p>つながると、この相手とあなたは互いに依頼を送れます。届いた依頼は受信箱で検査され、あなたが開くまで実行されません。依頼を送るたびに、送信前に確認画面が出ます。</p>
          <p>接続は制限付きです。</p>
          <p>この招待はリンクを知っている人なら誰でも使えます。心当たりのない招待は受け入れないでください。</p>
          <button className="ui-button" disabled={busy || (!!card.warnings?.length && acknowledged !== card.id) || Date.parse(card.expiresAt ?? "") <= Date.now()} onClick={() => { void decide("confirm"); }}>つながる</button>
        </>}
        <button ref={cancelRef} className="ui-button" disabled={busy} onClick={() => { void decide("cancel"); }}>キャンセル</button>
      </div>
    </section>}
  </>;
}
