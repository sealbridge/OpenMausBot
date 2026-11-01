# G2 verification record

Date: 2026-11-01. Branch: `g2/rebrand-foundation`.
Baseline: local `main` / HEAD `c731ce5f0071415584b72805a1bbdb168ac0093b`.
All G2 changes remain uncommitted. No global install, sudo, commit, push,
publishing, or mutation of the user's live application/data was performed.

## Local dependencies

Node `v24.22.1`, pnpm `10.33.0`:

```sh
COREPACK_HOME=/workspace/codex2/.corepack ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
  corepack pnpm install --frozen-lockfile --store-dir /workspace/codex2/.pnpm-store
```

Installation succeeded (944 packages). `node_modules` and
`build/sealbridge-runtime` are ignored and untracked by Git. The lockfile has
no diff; its SHA-256 before and after installation is
`22b1f621c51de49d73aed86c972250f75e0d914dfd64e789b811934e5fe2c5a3`.
No dependency/lockfile changes are part of G2.

`check:electron` subsequently fetched the local Electron executable through
the repository's existing loader. The optional pinned Sealbridge CLI was
installed into ignored `build/sealbridge-runtime` using
`npm_config_cache=/workspace/codex2/.npm-cache node scripts/prepare-sealbridge-runtime.mjs`.
Its first attempt hit the read-only default npm cache; the retry succeeded.

## Passed

Commands below used `COREPACK_HOME=/workspace/codex2/.corepack` for pnpm.
Raw logs are outside the repository in `/workspace/codex2/g2-checks/`.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed after removing the unused import in `server/config.ts` (`typecheck-fixed.log`, repeated successfully in `typecheck-final.log`) |
| `pnpm lint` | Passed after the fixes (`lint-final.log`) |
| `node scripts/check-fork-boundaries.mjs` | Passed |
| `node branding/generate.mjs --check` | Passed |
| `pnpm i18n:check` | Passed: 16 languages, 7,252 English strings |
| `pnpm check:electron` | Passed: 340 Electron modules syntax checked |
| Targeted Vitest command below | 14 files / 553 tests passed (`targeted.log`) |
| `pnpm exec vitest run server/edition.test.ts server/workspace-policy.test.ts` | 2 files / 14 tests passed |
| `pnpm exec vitest run server/config.test.ts server/local-computer.test.ts server/service-unit.test.ts` | 3 files / 232 tests passed |
| `pnpm broker:test` | 4 files / 102 tests passed |
| `pnpm exec tsc -p evals/tsconfig.json` | Passed |
| `pnpm exec vitest run --config evals/vitest.config.ts` | 13 files / 69 tests passed |
| `node --test electron/sealbridge.node-test.mjs` | 34 passed, 1 optional live test skipped before runtime installation |
| `node --test electron/sealbridge/live.node-test.mjs` after runtime preparation | 1 passed: pinned CLI initializes and lists tools |
| `pnpm test:packaged-server` | Build and all packaged server smoke checks passed |
| `pnpm exec vite build` | Passed; warnings described below |
| `git diff --check` | Passed |

```sh
pnpm exec vitest run scripts/check-fork-boundaries.test.mjs scripts/linux-after-install.test.mjs server/brand.test.ts src/lib/brand.test.ts src/lib/thread-refs.test.ts src/components/ChatMarkdown.test.ts src/components/SidebarThreadRow.test.ts src/components/ThreadRefs.test.ts src/hooks/use-external-chat-links.test.ts src/lib/page-open.test.ts scripts/ci-scope.test.ts scripts/ci-linux-lanes.test.ts scripts/ci-workflow.test.ts scripts/testing/verification-docs.test.ts
```

## Node suite and baseline comparison

```sh
node --test "electron/*.node-test.mjs" electron/sealbridge/product.node-test.mjs
```

Final run: **1,523 passed, 1 failed, 7 skipped** (1,531 total;
`node-final.log`). The sole failure is
`electron/vendor-updater.node-test.mjs`, “Electron relaunch waits for deferred
cleanup and the replacement acquires the same data directory”. It observes
`parentAlive: true` instead of `false`.

For comparison, `git archive main` was extracted to
`/workspace/codex2/g2-main` with a symlink to the same local dependencies.
`node --test electron/cloud-list.node-test.mjs electron/vendor-updater.node-test.mjs`
reproduced that exact updater failure on main (22 passed, 1 failed;
`main-node.log`). It is left unchanged as a baseline/environment failure.
Main's Cloud-sync-main and server-supervisor suites also passed (26 tests;
`main-fixtures.log`).

G2 failures fixed in this follow-up:

- Removed the unused `existsSync` import left after removing legacy migration;
  this blocked both typecheck and lint.
- Updated Cloud switcher title and Files output-folder expectations for
  Sealbridge Desktop.
- Updated the steer-queue integration fixture's config/database paths to the
  dedicated product directory; all 43 tests pass (`g2-steer-fixed.log`), as
  they do on main (`main-steer.log`).
- Supplied the real product configuration to the server-supervisor VM fixture
  and used dedicated local data paths so the purge checks exercise G2's guard.

The three corrected Node suites pass together: **39 tests** (`node-fixed.log`).

## Isolated server verification

Followed `docs/verification/README.md` and `chat-turns.md`:

```sh
node --experimental-strip-types scripts/control-omb.ts launch
node --experimental-strip-types scripts/control-omb.ts doctor --url http://127.0.0.1:20473
node --experimental-strip-types scripts/control-omb.ts new-bot --name G2-Probe --url http://127.0.0.1:20473
node --experimental-strip-types scripts/control-omb.ts send --bot BOT_ID --text hello --url http://127.0.0.1:20473
node --experimental-strip-types scripts/control-omb.ts wait --bot BOT_ID --timeout 30 --url http://127.0.0.1:20473
node --experimental-strip-types scripts/control-omb.ts messages --bot BOT_ID --limit 10 --url http://127.0.0.1:20473
```

The launcher created temporary home/data roots and selected the fake Claude
engine. Doctor reported connected with no problems, wait returned `settled`,
and messages included `hello from fake claude`. The fixture was stopped;
connection refusal was confirmed and its temporary data directory removed.
Evidence JSON is in `g2-checks`; the persistent server log is
`/tmp/openmausbot-verification-evidence/server-1793537647176-2.log`.
This verifies isolated startup and a fake-engine conversation, not native UI
or installer coexistence.

## Limits and warnings

- The unrestricted `pnpm exec vitest run --maxWorkers=4` was interrupted after
  approximately five minutes with only the run banner and no completed-file
  results. It is not a passing full-suite run.
- The broad run excluding `**/*.e2e.test.ts` and `**/*.e2e.test.mjs`, with
  `--fileParallelism --maxWorkers=4`, reached its 240-second timeout (exit 124).
  It reported five failures in `server/steer-queue.test.ts` (which embeds E2E
  tests despite its filename); these were fixed and its isolated rerun passes
  all 43 tests. The same broad selection on main reached its 180-second
  timeout (exit 124) without a completed-file summary. Logs: `vitest-unit.log`,
  `main-vitest-unit.log`. The rest of the full suite remains unverified.
- Vite builds succeed with CSS/third-party annotation/chunk-size warnings and
  a product JSON import-attribute consistency warning across renderer/shared
  transforms. Adding source attributes did not remove that warning through
  the React transform, so that attempted adjustment was reverted.
- Browser/desktop E2E gates, native OS coexistence, Linux package installation,
  signing/notarization, macOS/Windows packaging, behavior-eval runner tiers and
  external services have not been verified by this follow-up. No sudo was used.
- Earlier G2 checks also passed JS/shell syntax and image container/dimension
  checks, with the 1024 PNG visually inspected. Those checks are not native UI
  acceptance.

## Distribution and Git boundary

`LICENSE` and `NOTICE` have no diff. Release dispatch stays disabled and
updating stays disabled. Native distribution acceptance is deferred.
No Git staging or commit was attempted in this follow-up; `.git` is read-only.

## Windows contracts checkout EOL follow-up (2026-11-01)

The generator compares bytes. Without EOL attributes, a checkout with
`core.autocrlf=true` converts its text outputs to CRLF. The three SVG files
are generated with LF, as are the JSON-serialized `package.json` and
`public/manifest.webmanifest`; each would fail the byte comparison. The
reported SVG is simply the first output checked. `electron-builder.yml`,
`index.html`, and `electron/resources/speech-helper-Info.plist` retain source
line endings during replacement, so they do not independently exhibit the
same mismatch today, but could produce platform-dependent generated bytes.
PNG, ICO, and ICNS outputs are binary and have no text EOL conversion.

Added explicit `text eol=lf` attributes for all eight text outputs. This keeps
strict byte comparison and makes regeneration deterministic across checkouts,
without changing the generator or applying a repository-wide EOL policy.

A disposable Git repository copied the generator, product inputs, outputs,
and `.gitattributes` from this workspace. With `git config core.autocrlf true`,
`git add .`, and `git checkout-index --all --prefix=CHECKOUT/`, the original
attributes produced CRLF in all eight text outputs and reproduced
`Branding needs regeneration: branding/icons/icon.svg` (exit 1). Repeating
with the updated attributes produced LF in all eight outputs and
`node branding/generate.mjs --check` passed (exit 0), including all binary
outputs. The temporary repository and checkout were removed automatically.
This simulates Windows Git EOL conversion on Linux; it is not a native
Windows CI rerun.

Local validation:

- `node branding/generate.mjs --check`: passed.
- `node scripts/check-fork-boundaries.mjs`: attempted, blocked by this
  sandbox's `spawnSync git EPERM`. Shell `git ls-files --cached --others
  --exclude-standard -z` followed by the exported `checkSourceFiles` against
  the same workspace and file list passed with no errors.
- `COREPACK_HOME=/workspace/codex2/.corepack corepack pnpm exec vitest run
  scripts/check-fork-boundaries.test.mjs`: 33 tests passed.
- `node --test --test-isolation=none electron/rebrand.node-test.mjs
  electron/sealbridge/product.node-test.mjs`: 9 tests passed.
- `git diff --check`: passed.

No server/conversation behavior changed; no live application/data was used.
No staging or commit was performed.
