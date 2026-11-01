import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionRegistry } from "./sessions.ts";
import { cloudHomeConfiguration } from "./cloud-home.ts";
import * as policy from "./workspace-policy.ts";

const hosted = {
  OMB_ADMIN_URL: "https://admin.example.test", OMB_PUBLIC_URL: "https://workspace.example.test",
  OMB_ADMIN_WORKSPACE: "acme", OMB_ADMIN_MEMBERSHIP: "portal",
};
let directory: string | undefined;
function sessions() {
  directory ??= mkdtempSync(join(tmpdir(), "oss-policy-"));
  return new SessionRegistry({ file: join(directory, "sessions.json") });
}
afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); directory = undefined; });

function access(env: NodeJS.ProcessEnv) {
  return policy.createWorkspaceAccess({ sessions: sessions(), cookieName: "fixture", closeSessionStreams() {}, env });
}

describe("workspace policy", () => {
  it("leaves standalone auth and membership unchanged", () => {
    expect(policy.hostedWorkspaceConfigured({})).toBe(false);
    expect(policy.hostedWorkspaceConfiguration({})).toBeNull();
    expect(policy.workspaceMembership({})).toEqual({ authority: "local", pairingCodes: true });
    expect(policy.sharedWorkspaceFullAccessConfigured({})).toBe(false);
    expect(access({})).toBeNull();
    expect(access({ OMB_PUBLIC_URL: "https://local.example.test", OMB_SHARED_WORKSPACE_FULL_ACCESS: "1" })).toBeNull();
  });
  it.each(["OMB_ADMIN_URL", "OMB_ADMIN_WORKSPACE", "OMB_ADMIN_MEMBERSHIP"])("keeps partial or empty %s hosted without enabling local pairing", key => {
    for (const value of ["", "invalid"]) {
      const env = { [key]: value };
      expect(policy.hostedWorkspaceConfigured(env)).toBe(true);
      expect(policy.hostedWorkspaceConfiguration(env)).toBeNull();
      expect(policy.workspaceMembership(env)).toEqual({ authority: "local", pairingCodes: false });
      expect(access(env)).toBeNull();
    }
  });
  it("keeps complete hosted configuration without constructing an auth adapter", () => {
    expect(policy.hostedWorkspaceConfigured(hosted)).toBe(true);
    expect(access(hosted)).toBeNull();
    expect(policy.workspaceMembership(hosted)).toEqual({ authority: "portal", pairingCodes: false, peopleUrl: "https://admin.example.test/people?workspace=acme" });
    expect(policy.workspaceMembership({ ...hosted, OMB_ADMIN_MEMBERSHIP: "local" })).toEqual({ authority: "local", pairingCodes: false });
  });
  it.each(["OMB_LICENSE_KEY", "OMB_ENTERPRISE_DIR"])("ignores %s for standalone and Cloud home policy", key => {
    for (const value of ["", "fixture-value"]) {
      expect(access({ [key]: value })).toBeNull();
      expect(policy.hostedWorkspaceConfigured({ [key]: value })).toBe(false);
      expect(policy.workspaceMembership({ [key]: value })).toEqual({ authority: "local", pairingCodes: true });
      expect(cloudHomeConfiguration({
        OMB_CLOUD_ROLE: "home", OMB_CLOUD_MACHINE_ID: "fixture-machine",
        OMB_CLOUD_ADMIN_URL: "https://cloud.example.test", OMB_PUBLIC_URL: "https://home.example.test",
        OMB_CLOUD_BOOTSTRAP_SECRET: "s".repeat(43), [key]: value,
      })).toMatchObject({ role: "home", machineId: "fixture-machine" });
    }
  });
});
