# Fork modifications

This Apache-2.0 fork adds the G0 contract and G1 OSS boundary.
The final product name is Sealbridge Desktop; branding/product.json defines its
package identity. LICENSE and NOTICE are retained without changes.

Added files:

- branding/product.json
- electron/sealbridge/: product loader, MCP host, feature negotiation, adapter,
  identity-store contract, runtime resolver, errors/redaction, tests and fixtures
- electron/sealbridge.node-test.mjs: entry for the existing Electron test glob
- scripts/prepare-sealbridge-runtime.mjs
- docs/sealbridge/g0-contracts.md
- .github/workflows/sealbridge-desktop-g0.yml
- MODIFICATIONS.md

Upstream files modified by this change:

- .gitignore: ignore the prepared runtime build output
- README.md: link the G0 contracts and identify later branding/packaging hooks
- package.json: set the desktop package name, productName and desktopName
- electron-builder.yml: set appId, productName, Linux executableName and desktop Name;
  derive the NSIS shortcut from productName and include branding/product.json
- build/linux-after-install.sh, build/linux-after-remove.sh and
  build/linux-openmausbot-browser.apparmor: use the quoted product install root
  and current executable; retain profile/resource names and test-root hooks
- electron/main.mjs and electron/open-at-login.mjs: use the configured desktop name
- electron/cua.mjs, electron/cua-linux-runtime.cjs, server/local-computer.ts and
  CUA smokes/tests: use the configured appId for the embedded host and descriptors
- scripts/after-pack.mjs: derive the macOS app resource fallback from productName
- scripts/run-linux-package-smoke.mjs, scripts/smoke-linux-package.mjs,
  scripts/verify-linux-package.mjs, scripts/smoke-deb-command.mjs,
  scripts/smoke-deb-upgrade.mjs and scripts/smoke-linux-update.mjs: derive package,
  executable, desktop, install and userData paths from product.json
- scripts/defender-check-win.mjs and scripts/smoke-cua-win-lend.mjs: derive the
  Windows executable and app paths from productName
- server/service-unit.ts and tsconfig.server.json: read product.json for installed
  macOS/Linux Sentinel CLI discovery, including the bundled server build
- .github/workflows/ci.yml, package-linux.yml, package-win.yml and release.yml:
  derive installed/built app paths and package cleanup names; preserve artifact
  names and updater destinations; G1 disables public release publishing
- Existing product consistency, installer, after-pack, login and service tests:
  cover the current paths, quoted attachment and generated desktop entry

The G0 product loader and tests validate the identity fields and check mirrored
package/builder metadata and Linux shell literals against branding/product.json.
The contracts document userData and OS package identity changes and remaining G2
work: cosmetic brand strings, helper names, permission text, icons, mascot, DMG
visuals, URL scheme, data directories under ~/.openmausbot, artifact names, vendor
text, updater feed and publish destinations. The G1 changes below remove the separately licensed layer.
Existing OPENMAUSBOT_* and OMB_* environment hooks retain their names for
compatibility. Signing configuration, publisherName and credentials are unchanged.

## G1 OSS boundary

The separately licensed enterprise layer and loader, CLA procedure and public
publishers are removed. The server reports OSS with no entitlements, preserves
local owner access and hosted route refusals, and continues with an operator
notice for ignored legacy layer settings. It retains the Apache brand defaults
without applying brand.json. The renderer's license banner is removed;
legacy wire types remain compatible. Boundary regressions and unpacked-resource
checks cover source and packaging inputs. LICENSE and NOTICE are unchanged.
G2 visual branding, URL schemes and update-feed configuration are deferred.

Modified upstream files (including fork files extended in G1):

- `.github/CODEOWNERS`
- `.github/workflows/ci.yml`
- `.github/workflows/package-linux.yml`
- `.github/workflows/release.yml`
- `.github/workflows/sealbridge-desktop-g0.yml`
- `.oss-scanner/threat_model.md`
- `CONTRIBUTING.md`
- `LICENSING.md`
- `MODIFICATIONS.md`
- `README.md`
- `docs/ci.md`
- `docs/localization.md`
- `docs/releasing.md`
- `docs/self-hosting.md`
- `docs/verification/README.md`
- `docs/verification/guarded-messages.md`
- `docs/verification/hosted-slack-management.md`
- `docs/verification/hosted-workspaces.md`
- `docs/verification/memory-layer.md`
- `docs/verification/shared-workspace-trust.md`
- `docs/verification/spend-cap.md`
- `scripts/build-npm-package.mjs`
- `scripts/bundle-server.mjs`
- `scripts/ci-scope.mjs`
- `scripts/ci-scope.test.ts`
- `scripts/ci-workflow.test.ts`
- `scripts/control-omb.ts`
- `scripts/docker-image.test.ts`
- `scripts/packaged-native-modules.test.mjs`
- `scripts/smoke-packaged-server.mjs`
- `scripts/testing/verification-docs.test.ts`
- `scripts/testing/vitest-shard-weights.json`
- `scripts/tighten-ratchets.mjs`
- `server/brand.test.ts`
- `server/brand.ts`
- `server/built-in-instances.test.ts`
- `server/cli.ts`
- `server/cloud-home.ts`
- `server/drivers/acp/opencode-go.test.ts`
- `server/drivers/acp/opencode-go.ts`
- `server/drivers/codex.test.ts`
- `server/drivers/codex.ts`
- `server/hosted-access.test.ts`
- `server/hosted-models-api.test.ts`
- `server/hosted-models.test.ts`
- `server/hosted-models.ts`
- `server/hosted-slack.ts`
- `server/incidents.e2e.test.ts`
- `server/index.test.ts`
- `server/index.ts`
- `server/routes/mcp-servers.ts`
- `server/routes/status.ts`
- `server/routes/threads.ts`
- `server/spend-cap-api.test.ts`
- `server/spend.ts`
- `src/components/OrganizationSettings.test.ts`
- `src/components/OrganizationSettings.tsx`
- `src/components/SettingsModal.tsx`
- `src/lib/built-in-instances.ts`
- `src/locales/en.json`
- `src/locales/es.json`
- `src/locales/it.json`
- `src/locales/ja.json`
- `src/locales/ko.json`
- `src/locales/pl.json`
- `src/locales/pt-br.json`
- `src/locales/ru.json`
- `src/locales/tr.json`
- `src/locales/vi.json`
- `src/locales/zh-tw.json`
- `tsconfig.server.json`
- `vite.config.ts`

Deleted upstream files:

- `.github/workflows/connector-release.yml`
- `.github/workflows/contributors.yml`
- `.github/workflows/docker.yml`
- `.github/workflows/docs.yml`
- `.github/workflows/npm-package.yml`
- `.github/workflows/prepare-release.yml`
- `.github/workflows/sync-published-release.yml`
- `CLA.md`
- `docs/verification/enterprise-license.md`
- `enterprise/FEATURES`
- `enterprise/LICENSE`
- `enterprise/README.md`
- `enterprise/scripts/issue-license.mjs`
- `enterprise/server/index.ts`
- `enterprise/server/license.test.ts`
- `enterprise/server/license.ts`
- `enterprise/server/register.test.ts`
- `enterprise/server/workspace-access.test.ts`
- `enterprise/server/workspace-access.ts`
- `server/enterprise.test.ts`
- `server/enterprise.ts`
- `server/license-expiry-api.test.ts`
- `server/spend-cap-goal.e2e.test.ts`
- `src/components/LicenseExpiryBanner.test.ts`
- `src/components/LicenseExpiryBanner.tsx`

Added files:

- `server/edition.ts` and `server/edition.test.ts`
- `server/workspace-policy.ts` and `server/workspace-policy.test.ts`
- `scripts/check-fork-boundaries.mjs` and `scripts/check-fork-boundaries.test.mjs`
- `docs/sealbridge/upstream-sync.md`

## Upstream synchronization rehearsal

Integrated upstream snapshot `1f1e8f452aefc6e3c499a697de7fde10f05e3621`
over fork base `2ba2aa25e2c10b68c8e76b2688e8f737034f8459`.
The following upstream files retain fork modifications alongside upstream updates:

- `.github/workflows/release.yml`: retain the disabled release guard; omit the
  upstream release build change.
- `package.json`: adopt version `0.1.137` while retaining product identity.
- `scripts/ci-scope.mjs`: adopt locale test selection while retaining the OSS scope.
- `server/index.ts`: adopt cloud-move language and notification membership wiring
  while retaining the OSS edition and workspace boundaries.
- `src/locales/en.json` and `src/locales/ko.json`: adopt upstream catalog changes
  while retaining the fork's catalog changes.

Other upstream updates retain upstream attribution. The enterprise layer, CLA
procedure and deleted publishing workflows remain excluded.

The rehearsal branch also incorporates fork main `ca04b6c6d`, retaining its
sync procedure and rehearsal log, the explicit local-provider persistence
fixture in `server/hosted-models-api.test.ts`, and the boundary-checker copy in
`scripts/packaged-native-modules.test.mjs`. The sync covers
`88d54eb17..1f1e8f452` (22 changes taken; release-only change `43d3a84d1`
skipped). Newer upstream commits are left for the next sync.

## G2 rebrand foundation

Desktop identity is sourced from `branding/product.json`, including the disabled
update channel. Generated package/builder/web/speech mirrors are reproducible
without dependencies and checked before packaging and in the contract workflow.
Electron sets the product name, dedicated userData and Windows AppUserModelId
before path consumers and the single-instance lock. Desktop protocol handlers
and generated chat links use the fork's scheme. Server/CLI defaults use the
dedicated data root; automatic import of the upstream legacy root is removed.
Save-file validation, private-folder exclusion and document sync outputs follow
the dedicated roots. Linux browser AppArmor and macOS speech helper identities
are independent from the upstream application.

Upstream publish configuration is removed. Packaged startup does not initialize
the updater, download updates or schedule checks. Future distribution is planned
for one stable channel, with signing and an owned feed required first. Public
release workflows remain disabled; private packaging checks use the new names.

The temporary slate/white SB artwork replaces active desktop/web icons and
built-in normal/chrome/seasonal avatar display; upstream DMG artwork is disabled.
PNG, SVG, ICO and ICNS generation and replacement instructions live in `branding/`.
Legacy source illustration tools, helper names, locale strings, external service
URLs, author metadata, npm workspace names and internal compatibility keys remain
for later review. LICENSE and NOTICE remain byte-for-byte unchanged. See
`branding/README.md` for scope and `docs/sealbridge/g2-verification.md` for evidence
and unavailable checks. This change does not claim packaged OS or server workflow
acceptance without the required dependencies and isolated runtime fixtures.

Changed/added/deleted paths (upstream files and fork extensions):

- `.github/workflows/package-linux.yml`
- `.github/workflows/package-win.yml`
- `.github/workflows/sealbridge-desktop-g0.yml`
- `.gitignore`
- `LICENSING.md`
- `MODIFICATIONS.md`
- `README.md`
- `branding/README.md`
- `branding/generate.mjs`
- `branding/icons/icon.icns`
- `branding/icons/icon.ico`
- `branding/icons/icon.png`
- `branding/icons/icon.svg`
- `branding/product.json`
- `build/icon-1024.png`
- `build/icon.icns`
- `build/icon.ico`
- `build/icon.svg`
- `build/linux-after-install.sh`
- `build/linux-after-remove.sh`
- `build/linux-openmausbot-browser.apparmor`
- `build/linux-sealbridge-desktop-browser.apparmor`
- `docs/sealbridge/g2-verification.md`
- `electron-builder.yml`
- `electron/build-speech-helper.mjs`
- `electron/chat-link.mjs`
- `electron/chat-link.node-test.mjs`
- `electron/cloud-account.node-test.mjs`
- `electron/cloud-buy.node-test.mjs`
- `electron/cloud-entry.mjs`
- `electron/cloud-entry.node-test.mjs`
- `electron/cloud-sync.mjs`
- `electron/cloud-sync.node-test.mjs`
- `electron/environments.cjs`
- `electron/environments.node-test.mjs`
- `electron/error-pages.mjs`
- `electron/main.mjs`
- `electron/organization-entry.mjs`
- `electron/organization-entry.node-test.mjs`
- `electron/package-link.mjs`
- `electron/package-link.node-test.mjs`
- `electron/preload.node-test.mjs`
- `electron/rebrand.node-test.mjs`
- `electron/resources/app-icon.png`
- `electron/resources/speech-helper-Info.plist`
- `electron/save-file.mjs`
- `electron/save-file.node-test.mjs`
- `electron/sealbridge/product.mjs`
- `electron/sealbridge/product.node-test.mjs`
- `electron/speech.mjs`
- `electron/startup-screen.mjs`
- `electron/talk-main.mjs`
- `electron/talk-main.node-test.mjs`
- `electron/updater.mjs`
- `electron/vendor/electron-updater.cjs`
- `index.html`
- `package.json`
- `public/app-icon-192.png`
- `public/app-icon-512.png`
- `public/app-icon.svg`
- `public/apple-touch-icon.png`
- `public/manifest.webmanifest`
- `scripts/clean.mjs`
- `scripts/linux-after-install.test.mjs`
- `scripts/patch-organization-updater.mjs`
- `server/brand.ts`
- `server/cli.ts`
- `server/config.ts`
- `shared/use-my-computer.ts`
- `src/components/Avatar.tsx`
- `src/components/ChatMarkdown.test.ts`
- `src/components/ChatMarkdown.tsx`
- `src/components/CursorAvatar.tsx`
- `src/components/SidebarThreadRow.test.ts`
- `src/components/ThreadRefs.test.ts`
- `src/hooks/use-external-chat-links.test.ts`
- `src/lib/brand.test.ts`
- `src/lib/brand.ts`
- `src/lib/page-open.test.ts`
- `src/lib/thread-refs.test.ts`
- `src/lib/thread-refs.ts`
- `src/types/ogb.d.ts`
