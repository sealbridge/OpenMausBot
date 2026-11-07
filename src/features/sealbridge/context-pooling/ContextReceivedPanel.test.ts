// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { ReceivedAuditRecord } from "../../../../shared/sealbridge";
import { ContextReceivedPanel } from "./ContextReceivedPanel";

const answer = "<img src=x onerror=alert(1)> DW3_ANSWER_MARKER";
const input = "DW3_INPUT_MARKER";

it("shows hand-over output, states that view-only output stays in the audit, and deletes one file", async () => {
  const previous = window.ogb;
  const rows: ReceivedAuditRecord[] = [
    { id: "hand.jsonl", verified: true, outputRetained: true, deliveryMode: "hand_over", deliverable: answer },
    { id: "view.jsonl", verified: true, outputRetained: true, deliveryMode: "view_only" },
    { id: "bad.jsonl", verified: false, outputRetained: false },
  ];
  const deleteReceivedAudit = vi.fn().mockResolvedValue({ ok: true });
  const store = vi.spyOn(Storage.prototype, "setItem");
  const consoleLog = vi.spyOn(console, "log");
  Object.assign(window, { ogb: { sealbridge: { receivedAudits: vi.fn().mockResolvedValue(rows), deleteReceivedAudit } } });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(ContextReceivedPanel)));
    await vi.waitFor(() => expect(host.querySelectorAll("article").length).toBe(3));
    const articles = [...host.querySelectorAll("article")];
    expect(articles[0].textContent).toContain(answer);
    expect(articles[0].textContent).toContain("この記録には答えの中身が入っています");
    expect(articles[1].textContent).toContain("閲覧のみでも、答えは監査の記録に残っています。");
    expect(articles[1].textContent).toContain("この記録には答えの中身が入っています");
    expect(articles[1].textContent).not.toContain(answer);
    expect(articles[2].textContent).toContain("確かめられません");
    expect(articles[2].textContent).not.toContain(answer);
    expect(host.textContent).not.toContain(input);
    expect(host.querySelector("img")).toBeNull();
    const button = [...articles[2].querySelectorAll("button")].find(item => item.textContent === "この監査ファイルを消す")!;
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    button.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(deleteReceivedAudit).not.toHaveBeenCalled();
    flushSync(() => button.click());
    flushSync(() => [...articles[2].querySelectorAll("button")].find(item => item.textContent === "消す")!.click());
    await vi.waitFor(() => expect(deleteReceivedAudit).toHaveBeenCalledExactlyOnceWith("bad.jsonl"));
    await vi.waitFor(() => expect(host.textContent).not.toContain("確かめられません"));
    expect(readFileSync("src/features/sealbridge/context-pooling/ContextReceivedPanel.tsx", "utf8"))
      .not.toMatch(/dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB|console\./);
    expect(store).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  } finally { flushSync(() => root.unmount()); Object.assign(window, { ogb: previous }); vi.restoreAllMocks(); }
});
