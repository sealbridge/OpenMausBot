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
6. Finish the merge commit only after reviewing the exclusion result. Submit the
   integration PR without publishing artifacts or changing public release targets.

Keep fork-specific modules under their existing Sealbridge directories and keep
registration changes in upstream main/index files small. Review conflicts in the
Electron bridges, server entry, wire types, state store, branding and CI explicitly.

## Rehearsal log

- Placeholder: fill after the upstream synchronization rehearsal (upstream SHA,
  adopted/rejected changes, conflicts and resolutions, enterprise exclusion result,
  checks and merge commit).
