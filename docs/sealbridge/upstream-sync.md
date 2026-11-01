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
for a separate sync PR after G1 lands. That branch is not part of this PR.

- Upstream: `1f1e8f452aefc6e3c499a697de7fde10f05e3621` (`upstream/main`).
  Fork base: G1 `2ba2aa25e2c10b68c8e76b2688e8f737034f8459`; common ancestor:
  `88d54eb17a3655b968470cbbf3b5097de225a8b5`.
- Of 23 upstream commits, adopted 22 and rejected the release-only change
  `43d3a84d1`. The full history is available on the rehearsal branch linked above.
- The only conflict was `.github/workflows/release.yml`. Retained G1's complete
  disabled workflow: manual trigger, read-only permissions, explanatory message,
  and `exit 1`. Rejected upstream release build changes; no publishing was added.
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
