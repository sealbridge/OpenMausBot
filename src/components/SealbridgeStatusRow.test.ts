// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SealbridgeStatusRow } from "./SealbridgeStatusRow";

it("shows unavailable OS storage and retries through the fixed bridge", async () => {
  const status = vi.fn().mockResolvedValue({ state: "key-store-unavailable", did: null, version: null });
  const retry = vi.fn().mockResolvedValue({ state: "ready", did: "did:key:zFixture", version: "0.2.2" });
  const previous = window.ogb;
  Object.assign(window, { ogb: { sealbridge: { status, retry } } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(SealbridgeStatusRow)));
    await vi.waitFor(() => expect(host.textContent).toContain("OSの鍵保管庫を利用できません"));
    expect(host.querySelector("input")).toBeNull();
    flushSync(() => host.querySelector("button")!.click());
    await vi.waitFor(() => expect(host.textContent).toContain("did:key:zFixture"));
    expect(retry).toHaveBeenCalledExactlyOnceWith();
    expect(host.querySelector("button")).toBeNull();
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    Object.assign(window, { ogb: previous });
  }
});
