# Releasing

Public publishing is disabled in this fork. The release workflow is a manual-only
failing guard, and the other publishing workflows have been removed. Do not run
upstream publishing commands. A later milestone will configure distribution.

The Windows and Linux packaging workflows produce reviewable artifacts only.
See [CI](ci.md#main-and-public-publishing) for the fork boundary check and unpacked
artifact verification. Upstream merges follow [the sync procedure](sealbridge/upstream-sync.md).
