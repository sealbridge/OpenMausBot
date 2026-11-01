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
- electron-builder.yml: set appId, productName, Linux executableName and desktop Name

The G0 product loader and tests validate the identity fields and check the mirrored
package/builder metadata against branding/product.json. The contracts document
the resulting userData and OS package identity changes and remaining G2 paths.
No main/preload/server/renderer, enterprise, icon, installer script, AppArmor,
release destination or publish feed configuration is changed by G0.
