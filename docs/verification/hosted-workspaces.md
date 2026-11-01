# Hosted workspace configuration refusal

Hosted workspaces are not supported in this distribution. The presence of
`OMB_ADMIN_URL`, `OMB_ADMIN_WORKSPACE`, or `OMB_ADMIN_MEMBERSHIP`, including a
partial or empty value, retains the OSS build's hosted route checks without
refusing startup. Existing local owner access remains available under the same
loopback trust rules. Hosted configuration still defaults to service trust;
the desktop owner path and an explicit `OMB_LOOPBACK_TRUST=owner` retain their
existing behavior.

Hosted readiness, hosted sign-in, `/pair`, and the remote landing page return
503. Pairing and email sign-in POST routes return 403. These refusals say
“Hosted workspaces are not supported in this distribution.” Existing session
requests still pass through the session gate and then the hosted authorization
check; a hosted member never becomes a local owner or gains local sign-in as a
fallback. Invalid or revoked credentials retain their existing 401 response.

`OMB_LICENSE_KEY` and `OMB_ENTERPRISE_DIR`, including empty values, do not
prevent startup. The server continues as OSS with no entitlements. The admin
`/api/edition` response includes `EditionStatus.notice`, and the startup edition
log includes the same notice: the named settings have no effect in this
distribution. Their values are not printed. Member responses and the Settings
edition shape omit the operator notice. There is no external layer loader.

`OMB_PUBLIC_URL` alone remains available for ordinary self-hosting. Standalone
pairing and local membership retain their existing behavior. Complete
portal-managed workspace settings with explicit hosted model policy settings
construct the company provider policy independently of edition status.
The hosted route refusals above still apply. The Cloud home's existing
handling of obsolete gateway settings is unchanged. `brand.json` is validated
for diagnostics but is never applied.

## Driving it

```sh
pnpm exec vitest run server/workspace-policy.test.ts server/edition.test.ts server/hosted-access.test.ts server/hosted-models.test.ts server/hosted-models-api.test.ts
node --experimental-strip-types scripts/control-omb.ts launch
```

The hosted-access tests start real servers with disposable homes, the
verification launcher's environment builder, and a repository-owned fake
engine. They exercise complete, partial, and empty hosted settings, verify
local owner reads and writes, and assert the existing refusal status codes
for hosted routes and sessions. They also check the hosted service trust
default. Legacy layer settings are tested for continued startup, the admin
notice, the startup log line, member notice omission, and ordinary pairing.
A synthetic external layer would write a marker if evaluated; the tests
assert that the marker is absent.

Each HTTP fixture prints its URL and persistent log path. The log records
request methods, paths, and response statuses without credentials. Use the
URL printed by the isolated launcher for the standalone check:

```sh
pnpm control:omb doctor --url http://127.0.0.1:PORT
```

Stop the foreground launcher with Ctrl-C. Follow [the fixture instructions](README.md)
for cleanup and evidence. A listen or spawn EPERM in a restricted environment is
an environment limitation; record it without changing the fixture isolation.
