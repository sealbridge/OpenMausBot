# Fork modifications

This Apache-2.0 fork adds the G0 contract and startup verification experiment.
The product identity in branding/product.json is provisional. LICENSE and NOTICE
are retained without changes.

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

No main/preload/server/renderer, enterprise, package identity, icon, builder,
release or publish configuration is changed by G0.
