import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const headers = await readFile(new URL("../_headers", import.meta.url), "utf8");
const lines = headers.split(/\r?\n/);
const reportOnly = lines.find(line => /^\s*Content-Security-Policy-Report-Only:/i.test(line));
assert.ok(reportOnly, "A report-only CSP baseline must be present.");
assert.equal(
  lines.some(line => /^\s*Content-Security-Policy:/i.test(line) &&
    !/^\s*Content-Security-Policy-Report-Only:/i.test(line)),
  false,
  "Do not enforce CSP until report-only compatibility has been reviewed."
);
const policy = reportOnly.slice(reportOnly.indexOf(":") + 1);
for (const directive of [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "frame-src",
  "worker-src 'self'",
  "manifest-src 'self'"
]) {
  assert.ok(policy.includes(directive), "CSP directive is missing: " + directive);
}
for (const requiredOrigin of [
  "https://unpkg.com",
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://flagcdn.com",
  "https://tile.openstreetmap.org",
  "https://pagead2.googlesyndication.com"
]) {
  assert.ok(policy.includes(requiredOrigin), "CSP does not account for a reviewed page dependency: " + requiredOrigin);
}
assert.ok(lines.some(line => /^\s*X-Frame-Options:\s*DENY\s*$/i.test(line)));
assert.ok(lines.some(line => /^\s*X-Content-Type-Options:\s*nosniff\s*$/i.test(line)));

console.log("Security header baseline tests passed: report-only CSP and existing browser security headers.");
