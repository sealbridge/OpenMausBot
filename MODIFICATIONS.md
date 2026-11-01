# Fork modifications

This Apache-2.0 fork adds the G0 contract and startup verification experiment.
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
  names, updater destinations and publishing behavior
- Existing product consistency, installer, after-pack, login and service tests:
  cover the current paths, quoted attachment and generated desktop entry

The G0 product loader and tests validate the identity fields and check mirrored
package/builder metadata and Linux shell literals against branding/product.json.
The contracts document userData and OS package identity changes and remaining G2
work: cosmetic brand strings, helper names, permission text, icons, mascot, DMG
visuals, URL scheme, data directories under ~/.openmausbot, artifact names, vendor
text, updater feed and publish destinations. Enterprise code remains unchanged.
Existing OPENMAUSBOT_* and OMB_* environment hooks retain their names for
compatibility. Signing configuration, publisherName and credentials are unchanged.
