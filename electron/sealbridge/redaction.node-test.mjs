import assert from "node:assert/strict";
import test from "node:test";
import { redact, containsSecret } from "./redaction.mjs";
import { product } from "./product.mjs";

test("diagnostics redact invite forms, private key records and PEM including truncated material", () => {
  for (const input of ["acp-invite:fixture-only", "ACP://INVITE/fixture-only", `${product.urlScheme}://invite#fixture-only`,
    'privateKey="fixture-only"', '{"privateKeyHex":"fixture-only"}', "secret_key: fixture-only", "seed=fixture-only",
    "-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----", "-----BEGIN ED25519 PRIVATE KEY-----\nfixture-only"] ) {
    assert.ok(!redact(input).includes("fixture-only"));
  }
  assert.equal(redact("ordinary diagnostic"), "ordinary diagnostic");
  assert.ok(containsSecret({ inviteToken: "anything" }));
  assert.ok(containsSecret({ nested: { link: "acp-invite:fixture-only" } }));
  assert.equal(containsSecret({ workerDid: "did:example:worker" }), false);
});
