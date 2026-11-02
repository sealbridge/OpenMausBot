// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { InviteView } from "./InviteView";

it("previews public metadata and requires an explicit limited connection decision", async () => {
  const previous = window.ogb;
  const inviteDecision = vi.fn().mockResolvedValue({ ok: true });
  const invites = vi.fn().mockResolvedValue([{ id: "11111111-1111-1111-1111-111111111111", state: "pending",
    displayName: "Fixture peer <script>", peerDid: "did:key:zAAAA…AAAA", expiresAt: "2099-01-01T00:00:00Z" }]);
  const pasteInvite = vi.fn().mockResolvedValue({ ok: true });
  Object.assign(window, { ogb: { sealbridge: { invites, inviteDecision, pasteInvite } } });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(InviteView)));
    await vi.waitFor(() => expect(host.textContent).toContain("Fixture peer <script>"));
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("input")).toBeNull();
    expect(inviteDecision).not.toHaveBeenCalled();
    expect(host.textContent).toContain("制限付き");
    expect(host.textContent).not.toMatch(/trusted|常に許可/);
    flushSync(() => Array.from(host.querySelectorAll("button")).find(b => b.textContent === "つながる")!.click());
    await vi.waitFor(() => expect(inviteDecision).toHaveBeenCalledExactlyOnceWith("11111111-1111-1111-1111-111111111111", "confirm"));
    await vi.waitFor(() => expect(host.querySelector('[role="dialog"]')).toBeNull());
    expect(host.textContent).toContain("相手からの応答を待っています");
  } finally { flushSync(() => root.unmount()); host.remove(); Object.assign(window, { ogb: previous }); }
});

it("expired previews disable connecting and allow cancellation by opaque ID", async () => {
  const previous = window.ogb, inviteDecision = vi.fn().mockResolvedValue({ ok: true });
  Object.assign(window, { ogb: { sealbridge: { invites: async () => [{ id: "fixture-id", state: "pending",
    displayName: "Expired fixture", expiresAt: "2000-01-01T00:00:00Z" }], inviteDecision } } });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(InviteView)));
    await vi.waitFor(() => expect(host.textContent).toContain("Expired fixture"));
    const buttons = Array.from(host.querySelectorAll("button"));
    expect(buttons.find(b => b.textContent === "つながる")!.disabled).toBe(true);
    flushSync(() => buttons.find(b => b.textContent === "キャンセル")!.click());
    await vi.waitFor(() => expect(inviteDecision).toHaveBeenCalledWith("fixture-id", "cancel"));
  } finally { flushSync(() => root.unmount()); Object.assign(window, { ogb: previous }); }
});

it("requires warning acknowledgement and shows incomplete deletion after closing", async () => {
  const previous = window.ogb, inviteDecision = vi.fn().mockResolvedValue({ ok: true, state: "cancelled-incomplete" });
  Object.assign(window, { ogb: { sealbridge: { invites: async () => [{ id: "warning-fixture", state: "pending",
    displayName: "Known name", peerDid: "did:key:zBBBB…BBBB", expiresAt: "2099-01-01T00:00:00Z",
    warnings: ["same-name-different-did", "identity-changed"] }], inviteDecision } } });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(InviteView)));
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')).not.toBeNull());
    expect(host.textContent).toContain("同じ名前の別の相手");
    expect(host.textContent).toContain("以前と異なる識別情報");
    const button = (name: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent === name)!;
    expect(button("つながる").disabled).toBe(true);
    flushSync(() => button("つながる").click());
    expect(inviteDecision).not.toHaveBeenCalled();
    flushSync(() => button("警告を確認しました").click());
    expect(button("つながる").disabled).toBe(false);
    flushSync(() => button("キャンセル").click());
    await vi.waitFor(() => expect(host.querySelector('[role="dialog"]')).toBeNull());
    expect(host.textContent).toContain("保管庫から完全に削除できなかった可能性があります。");
  } finally { flushSync(() => root.unmount()); host.remove(); Object.assign(window, { ogb: previous }); }
});
