# Entitlement-only configuration in the OSS server

This fork grants no entitlements. Saved entitlement-only configuration remains
inert, matching the upstream OSS build. No external layer fixture is supported.
The ordinary ledger and provider settings retain their local behavior.

## Driving it

```sh
pnpm exec vitest run server/spend-cap-api.test.ts server/spend.test.ts
```

The API regression launches an isolated fake-engine server, saves entitlement-only
configuration, checks that the corresponding API fields remain null, and completes
a normal chat turn. It prints the fixture log path and removes its temporary home.
See [the fixture instructions](README.md).
