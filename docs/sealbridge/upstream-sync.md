# Upstream synchronization

Use the fork as `origin` and the upstream OpenMausBot repository as a read-only
`upstream`. Work on a dedicated integration branch and open a PR into the fork's
main branch. Choose a weekly or monthly cadence after observing upstream activity.

1. Record the upstream commit SHA and review its changed and renamed paths.
2. Merge with a merge commit (`git merge --no-ff --no-commit upstream/main`).
   Do not rebase or squash an upstream synchronization.
3. Resolve conflicts while retaining the fork's edition and workspace boundaries.
   Inspect newly added, changed and renamed enterprise paths and all build inputs.
   If the excluded directory returns, run `git rm -r enterprise` before finishing
   the merge. Ignoring the directory does not exclude tracked files.
4. Record adopted and rejected changes, conflict resolutions, and the enterprise
   exclusion result in the PR. Preserve upstream attribution and third-party
   license notices. Update MODIFICATIONS.md for changed upstream files.
5. Run `node scripts/check-fork-boundaries.mjs` before finishing the merge, then
   typecheck, lint, relevant tests, and build. Check unpacked distribution resources
   with `node scripts/check-fork-boundaries.mjs <artifact-directory>`. Remove stale
   generated outputs and rebuild if the artifact check rejects them.
6. Review the exclusion result, stage the resolved files, and commit the merge
   with `git commit`. Submit the integration PR without publishing artifacts or
   changing public release targets.

Keep fork-specific modules under their existing Sealbridge directories and keep
registration changes in upstream main/index files small. Review conflicts in the
Electron bridges, server entry, wire types, state store, branding and CI explicitly.

## Rehearsal log

The 2026-11-01 rehearsal is retained on
[`sync/upstream-rehearsal`](https://github.com/sealbridge/OpenMausBot/tree/sync/upstream-rehearsal)
and is now proposed as a sync PR into the fork's main branch after G1 landed
as squash merge `ca04b6c6d`.

- Upstream: `1f1e8f452aefc6e3c499a697de7fde10f05e3621` (`upstream/main`).
  Fork base: G1 `2ba2aa25e2c10b68c8e76b2688e8f737034f8459`; common ancestor:
  `88d54eb17a3655b968470cbbf3b5097de225a8b5`.
- Upstream range: `88d54eb17..1f1e8f452`, 23 commits: 22 taken and the
  release-only change `43d3a84d1` skipped. The full history is available on the
  rehearsal branch linked above.
- The only conflict in the upstream merge was `.github/workflows/release.yml`.
  Retained G1's complete disabled workflow: manual trigger, read-only permissions,
  explanatory message, and `exit 1`. Rejected upstream release build changes; no publishing was added.
- Exclusions: no enterprise files, `CLA.md`, contributors workflow, deleted
  publishers, enterprise imports/loaders, or additional loader environment access
  were reintroduced. No additional removals were needed. Fork identity and OSS
  edition/workspace boundaries were retained.
- Used `git merge --no-ff --no-commit upstream/main`, resolved the conflict,
  checked boundaries, and committed merge `ab9835f71` with parents G1 `2ba2aa25e`
  and upstream `1f1e8f452`. No rebase was used.
- Checks: lint, typecheck, i18n, app/server builds, and source/generated-output
  boundary checks passed. The source boundary check used the exported checker
  after Git spawning returned `EPERM`. Runtime/fixture suites had failed or
  incomplete results, including subprocess/loopback `EPERM`; they remain to be
  confirmed by CI on the sync PR.
- The rehearsal branch was then merged with fork main `ca04b6c6d` using
  `git merge --no-ff --no-commit origin/main`; the merge contents are resolved
  and await staging and a merge commit. `server/hosted-models-api.test.ts` takes
  main's G1 version, including the `d4507627b` fixture fix that saves explicit
  local provider settings and checks persistence. The selected upstream range
  did not change that test file; no enterprise fixtures were restored.
  `docs/sealbridge/upstream-sync.md` retains main's procedure and rehearsal log
  with this update. `MODIFICATIONS.md` combines both sides without duplicate
  entries and records the packaging fixture fix retained from main.
- Newer upstream commits after `1f1e8f452` are not included and are left for the
  next sync.
- Checks on the contents merged with main: `pnpm lint`, `pnpm typecheck`,
  `pnpm i18n:check` (16 locale catalogs), and all 33 boundary tests passed.
  The source boundary checker passed across 6,439 deduplicated paths through
  its exported `checkSourceFiles` function after the CLI could not spawn Git
  (`spawnSync git EPERM`). Explicit excluded-path checks, conflict-marker
  scanning, and `git diff --check` passed. An isolated verification launch
  could not reserve a fixture port pair; server/conversation runtime behavior
  remains unverified here. No check used the user's live application or data.
