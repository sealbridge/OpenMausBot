import { expect, it } from "vitest";
import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";

it("keeps local turns available with saved entitlement-only settings", async () => {
  const fixture = await launchVerificationServer();
  try {
    const url = fixture.info.url;
    const api = (path: string, body?: unknown) => fetch(url + path, body === undefined ? {} : {
      method: "PUT", headers: { "content-type": "application/json", origin: url }, body: JSON.stringify(body),
    });
    expect(await (await api("/api/edition")).json()).toEqual({ edition: "oss", features: [] });
    expect((await api("/api/config", { budgets: { monthlyUsd: 0 }, billing: { prices: { default: { inputPerMillion: 1, outputPerMillion: 1 } } } })).status).toBe(200);
    const usage = await (await api("/api/usage")).json() as { budget: unknown; billing: unknown };
    expect(usage.budget).toBeNull();
    expect(usage.billing).toBeNull();
    const created = await runControlOmb(["new-bot", "--name", "OSS Fixture", "--url", url]) as { bot: { id: string } };
    await runControlOmb(["send", "--bot", created.bot.id, "--text", "Reply with the synthetic fixture response.", "--url", url]);
    const settled = await runControlOmb(["wait", "--bot", created.bot.id, "--timeout", "30", "--url", url]) as { status: string };
    expect(settled.status).toBe("settled");
  } finally { console.info(JSON.stringify(fixture.info)); await fixture.close(); }
}, 90_000);
