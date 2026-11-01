# G0 contracts and startup verification

G0 adds isolated modules for product configuration, a supervised stdio MCP client,
feature negotiation, a provisional main-process adapter, an identity-store contract,
and a pinned CLI preparation experiment. It does not register IPC, launch from
`main.mjs`, add screens, route URLs, or change the installed application's identity.

`branding/product.json` is the identity source. Its product name and appId are
placeholders pending a naming decision. `product.mjs` validates and freezes it.
The CLI package name and version, relay, scheme, and data-directory name also come
from this file. Existing application branding is unchanged.

## Provisional adapter API

`createAdapter(options)` accepts a host/runtime and optional main-only providers:
`identityStore`, `inviteImporter`, `approvalChannel`, and `requestChannel`.
Asynchronous operations return `{ok: true, value}` or
`{ok: false, error: {code, ...}}`. Unsupported operations use
`SEALBRIDGE_NOT_SUPPORTED` and the operation name. Provider failures return
`SEALBRIDGE_OPERATION_FAILED` without copying exception text.

| Operation | G0 behavior |
| --- | --- |
| `bootstrap()` | Start host; initialize, notify initialized, list tools; return public identity if a store is injected, relay, negotiated features, and sending state. Without a provider the CLI identity is ephemeral. |
| `importInvite(secretInput)` | Unsupported on 0.2.2. An importer plus explicit import signal and alias tool are required. Only an opaque alias and public contact fields are returned. |
| `listPublicWorkers(query = "")` | Call `acp_discover_workers` and filter locally by text. Return projected directory fields. All cards have `accessMode: "unknown"`; directory membership does not establish open access. |
| `submitRequest(targetRef, draft)` | Disabled on 0.2.2. Requires delegate tool, explicit host-approval signals, approval provider and request provider. A future provider maps alias/DID arguments and returns an opaque handle. |
| `onApproval(callback)` / `answerApproval(id, decision)` | Future approval-provider subscription and correlated response; decisions are `accept`, `decline`, `cancel`. Unsupported without the negotiated contract. Subscriptions return an unsubscribe function. |
| `onStatus(callback)` | Subscribe to public bootstrap status; returns an unsubscribe function. Future lifecycle notifications require core integration. |
| `cancelRequest(handle)` / `getRequest(handle)` | Unsupported on 0.2.2; explicit capability signals and request-provider methods are required. Process termination is not a cancellation acknowledgement. |
| `close()` | Stop the host and remove local subscriptions. Never replay requests. |

Providers are trusted main-process integrations. They must enforce the eventual
core schemas, approval correlation and public DTO boundaries. They are not exposed
as renderer callbacks. G0 does not invent the pending core argument contracts.

## Feature negotiation

The recorded fixture projects protocol, server metadata, capabilities, and tool
names from an actual 0.2.2 initialize/tools/list exchange. No relay connection is
needed. Unknown features default to false; a higher version alone enables nothing.

| Contract | CLI 0.2.2 | Pending hook |
| --- | --- | --- |
| MCP | `2024-11-05`, server `sealbridge-mcp-server`, version `0.2.2` | Protocol compatibility remains explicit |
| Single/multiple delegation | `acp_delegate_task`, `acp_delegate_multi` present | GUI sending still requires host approval |
| Directory discovery | `acp_discover_workers` | Open access/card fields require an explicit extension |
| Audit/revocation/invite creation | `acp_verify_audit_bundle`, `acp_revoke_token`, `acp_inspect_revocations`, `acp_create_invite` present | No G0 adapter operations for these |
| Invite aliases/import | No `acp_list_invites`, no `accept` | Import provider consumes a transient secret through the future non-MCP input channel |
| Identity setup | No `setup`; no-key MCP identity is ephemeral | Core identity provider and private startup transport |
| Host approval | No elicitation/host contract | Approval channel and a host implementing bidirectional requests |
| Open discovery / relay authentication recovery | No negotiated contract | Runtime signals; `RELAY_AUTH_RECOVERY_EXHAUSTED` remains a core-owned result |
| Request status / cancellation | No exposed contract | Request provider after core status/acknowledgement schema agreement |

For tests and future adaptation, `capabilities.experimental.sealbridge` is a
**provisional local signal vocabulary**, not a claim about a published core API.
Boolean `hostApproval` and `elicitation` must both be true for host approval.
`openWorkerDiscovery`, `identityBootstrap`, `inviteImport`, `relayAuthRecovery`,
`requestStatus`, and `requestCancellation` are independently explicit booleans;
import additionally requires `acp_list_invites`, discovery its discovery tool.
When core publishes signals, change their mapping in `capabilities.mjs`.
The G0 host advertises empty client capabilities and rejects incoming server
requests with method-not-supported. A later approval provider must be paired with
a host implementing the agreed elicitation contract before enabling sends.

## Secret transport and OS storage contract

Raw invite input stays in transient main memory. It must not enter argv,
environment variables, MCP arguments, renderer state, conversations, or logs. The
importer receives it directly through a main-only provider call; future CLI
integration requires a dedicated private input channel. G0 does not implement
`accept` or pass an invite to an existing MCP tool. Tokens are never returned by
the adapter. Core owns invite verification and alias persistence.

Private key material stays in main and the core's agreed private startup channel.
It must not enter argv, environment variables, renderer state, or plaintext files.
`createIdentityStore` exposes only `getPublicInfo()` and `ensureIdentity()` returning
DID/public key. The injected core provider creates/restores records; this module
neither generates keys nor supplies them to 0.2.2's file-based `--key` option.
An injected store's public identity is not bound to the 0.2.2 MCP process; its
identity mode remains ephemeral until a core bootstrap contract is integrated.
Storage writes only safeStorage ciphertext, checks encryption availability,
refuses Linux `basic_text` and unknown Linux backends, and has no plaintext
fallback. Existing `readSecureCredentials` handles encrypted record reads.
Unreadable records block replacement. Creation uses an exclusive write; a losing
concurrent creator cannot overwrite the existing identity. This is a contract
stub: core record format, atomic persistence, Windows ACLs and actual OS keychain
behavior still need G3 integration tests.

The host uses an absolute Node binary and CLI JavaScript entry, an argument array,
`shell: false`, and a temporary home/cwd. It forwards only selected OS/locale
variables. It does not inherit arbitrary credentials, Node injection variables,
or CLI data-directory selectors. It starts with `--relay` from configuration and
`--require-approval`; no key file, webhook or automatic approval is supplied.
Do not treat interactive approval as the missing host-approval contract.

JSON-RPC frames have numeric request IDs, byte bounds and request deadlines.
Timeouts reject pending calls, close stdin, and force process termination after a
short grace period. There is no automatic restart/retry of non-idempotent calls.
Stdout frames are never logged. Stderr retains a bounded prefix and is redacted
before exposure, including invite schemes and private-key records/PEM. RPC/provider
error text is not copied into public errors. Discovery projects public fields and
never labels a 0.2.2 directory card as accepting open requests.

## Runtime preparation and verification

```sh
node scripts/prepare-sealbridge-runtime.mjs
node --test electron/sealbridge.node-test.mjs
node --test electron/sealbridge/live.node-test.mjs
pnpm test:electron
pnpm lint
pnpm typecheck
```

Preparation installs the configured CLI version into ignored
`build/sealbridge-runtime/` with npm `--ignore-scripts --omit=dev`, verifies package
name/version and CLI entry, and prints the resolved entry. This is a build-time
experiment, not an application startup download. The generated npm lock remains
in that ignored output; reproducible transitive dependency pinning remains a
packaging question. npm is invoked through Node and its JavaScript entry on both
platforms, without command shims.

The live test runs only when `SEALBRIDGE_CLI_ENTRY` is explicitly set or a prepared
runtime exists. For the supplied reference installation:

```sh
SEALBRIDGE_CLI_ENTRY=/tmp/sb022/node_modules/sealbridge/dist/cli/dist/index.js node --test electron/sealbridge/live.node-test.mjs
```

Tests launch isolated fake/real CLI processes with disposable homes and no real
keys, invite inputs, or delegation. They do not mutate an application fixture or
user data. Tests are included in the existing Electron test glob by
`electron/sealbridge.node-test.mjs`. The separate PR/manual workflow tests Linux
and Windows on Node 24, then prepares the runtime and runs live negotiation.
Actual OS storage and packaged Electron behavior are outside this verification.

The published CLI declares Node `>=22`; this experiment uses Node 24. The plan's
separate Node 22 bundling proposal remains open. `resolveRuntime` accepts a
resolved Node binary and either a development directory or packaged
`resourcesPath/sealbridge-runtime`. It does not download or select a system CLI.

## Core questions and later milestones

Confirm private identity startup transport and shared identity/alias persistence;
import input transport and alias lifetime; approval capability spelling, protocol,
correlation, rejection and expiry; open worker-card fields; recovery notifications;
and request handles, cancellation acknowledgements and duplicate prevention.
Confirm the supported bundled Node version, binary licensing, architectures,
packaging size and nested signing requirements. No automatic delegation retry is
permitted without a core replay/deduplication contract.

G1 owns enterprise removal and its build boundaries. G2 consumes product.json for
package/build identity, schemes, data paths, names and icons. G3 adds the explicit
runtime preparation step to packaging and the runtime directory/Node binary to
`extraResources`, validates packaged paths, wires lifecycle and limited IPC into
main, and connects the agreed identity/approval providers. Later milestones own
URL routing, cards and screens. LICENSE and NOTICE remain unchanged in G0.
