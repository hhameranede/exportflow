import assert from "node:assert/strict";
import test from "node:test";
import { createDnsRebindingHostname } from "../scripts/acceptance/dns-rebinding-hostname.mjs";

test("1u.ms rebinding hostname uses its documented interval and after-times grammar", () => {
  assert.equal(
    createDnsRebindingHostname("188.184.67.127", "127.0.0.1", "runtime-acceptance-12345678", 0),
    "make-188.184.67.127-rebindfor30safter0times-127.0.0.1-rr-runtime-acceptance-12345678.1u.ms",
  );
  assert.equal(
    createDnsRebindingHostname("188.184.67.127", "10.0.0.1", "runner-doh-12345678", 2),
    "make-188.184.67.127-rebindfor30safter2times-10.0.0.1-rr-runner-doh-12345678.1u.ms",
  );
});

test("1u.ms rebinding hostname preserves suffix sanitization and rejects invalid counts", () => {
  assert.equal(
    createDnsRebindingHostname("188.184.67.127", "0.0.0.0", "RUNNER / SYSTEM 12345678", 1),
    "make-188.184.67.127-rebindfor30safter1times-0.0.0.0-rr-runner-system-12345678.1u.ms",
  );
  assert.throws(
    () => createDnsRebindingHostname("188.184.67.127", "127.0.0.1", "runtime-acceptance-12345678", 3),
    /supported public-answer count/,
  );
});
