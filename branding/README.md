# Sealbridge Desktop branding

`product.json` is the source of desktop identity. Electron, the server/CLI and
renderer read it. The builder YAML, package metadata, web manifest, HTML title
and speech helper plist have generated mirrors. Linux installer shell paths and
AppArmor attachment paths are checked by the product contract tests; edit these
together if the executable name changes.

From the repository root, with Node 24 and no additional dependencies:

```sh
node branding/generate.mjs
node branding/generate.mjs --check
```

The first command updates mirrors and generates the temporary **SB** block mark.
The second is read-only and fails on drift. Packaging and the G0 contract workflow
run the check. The pixel grid and colours in `generate.mjs` are the single artwork
source: replace them there to change the placeholder. A permanent design can
replace that generator's SVG/raster rendering while preserving its output paths.
Do not edit generated copies independently.

Outputs:

- `branding/icons/icon.svg`, `icon.png` (1024), `icon.ico` (256 PNG entry),
  `icon.icns` (128/256/512/1024 PNG entries): electron-builder icons.
- `public/app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`,
  `apple-touch-icon.png`: web and renderer icons.
- `electron/resources/app-icon.png`: windows, startup and tray.
- `build/icon.svg`, `icon-1024.png`, `icon.ico`, `icon.icns`: compatibility copies
  for existing packaging and verification tools.

All requested formats can be generated locally. Their consumption by native
macOS/Windows/Linux installers still needs package tests on those systems. The
DMG uses a plain background (`background: null`); upstream DMG artwork is not
selected. Built-in normal, chrome and seasonal avatars use the temporary mark;
shape/face/colour customization controls are retained but do not customize the
placeholder. User-supplied profile pictures remain supported. Unreferenced
upstream artwork and developer illustration tools remain in the source tree.

## Storage and OS identity

| Surface | Identity / default |
| --- | --- |
| Product | Sealbridge Desktop |
| appId / Windows AppUserModelId | `dev.sealbridge.desktop` |
| Desktop entry / Linux executable | `sealbridge-desktop.desktop` / `sealbridge-desktop` |
| URL protocol | `sealbridge://` (upstream `openmausbot://` is not handled) |
| Electron userData, including instance lock | `app.getPath("appData")/sealbridge-desktop` |
| Server / CLI data | `~/.sealbridge-desktop` |
| Named local environments | `~/.sealbridge-desktop-<slug>` |
| Synced document outputs | `Documents/Sealbridge Desktop` |
| Linux browser AppArmor profile | `sealbridge-desktop-browser` |
| macOS speech helper bundle ID | `dev.sealbridge.desktop.speech-helper` |
| Installer artifacts | `Sealbridge-Desktop-<version>-…` |

No data is imported from `~/.openmausbot` or `~/.opengrokbot`. Existing explicit
`OMB_DATA_DIR` and environment selections remain operator overrides. They can
point anywhere the operator chooses, so do not point them at upstream data when
running both products. Server leases remain relative to the selected data root.
Electron partitions are relative to the dedicated profile. Existing loopback
port selection tries the first free port, allowing concurrent applications;
coexistence on real OS installations is not proven by source/unit checks.

## Updates and distribution

`updateChannel: "disabled"` is the only accepted setting for now. Packaged startup
returns before loading electron-updater, creating its coordinator or scheduling
checks; update IPC cannot start downloads or installation. `publish: null`
removes the upstream feed from packaging, and Windows CI rejects an unexpected
`app-update.yml`. Public release workflows stay disabled.

Future distribution will use **one stable channel**. Enabling it requires an
owned feed, signing configuration, native install/update verification and a
reviewed change to the configuration validator and runtime gate. This is not a
runtime toggle to an upstream feed. Vendored updater code is retained for that
future work; its protocol relaunch patch is generated from product identity.

## Scope left for later

CODEOWNERS, npm workspace/CLI package names, upstream author/repository/homepage
metadata and license attribution are unchanged. Existing `OMB_*` /
`OPENMAUSBOT_*` environment variables and internal wire/header/lease names retain
compatibility; they do not create a shared OS registration under the new defaults.
Companion mobile pairing and its own protocol, Docker/container IDs, external
Cloud/Admin/support URLs and service names, legacy helper-bot names and locale
catalogue strings require their own product/compatibility decisions. They have
not been relabelled as Sealbridge services. No new service destination is invented.
These remaining surfaces need review before public distribution. This foundation
does not implement Sealbridge invite handling or change the G0/G3/G4 contracts.
