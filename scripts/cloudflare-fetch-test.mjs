import assert from "node:assert/strict";
import { createCloudflareFetch } from "../functions/lib/cloudflare-fetch.mjs";

const calls = [];
const fakeFetch = async (input, init) => {
  calls.push({ input, init });
  return new Response("ok", { status: 200 });
};

const wrapped = createCloudflareFetch(fakeFetch);

await wrapped("https://carrier.example/track", { redirect: "error" });
assert.equal(calls.at(-1).init.redirect, "manual", "error mode must become manual for Cloudflare");

await wrapped("https://carrier.example/track", { redirect: "follow" });
assert.equal(calls.at(-1).init.redirect, "follow", "explicit follow must be preserved");

await wrapped("https://carrier.example/track", { redirect: "manual" });
assert.equal(calls.at(-1).init.redirect, "manual", "explicit manual must be preserved");

await wrapped("https://carrier.example/track", {});
assert.equal(calls.at(-1).init.redirect, undefined, "unspecified redirect must stay unspecified");

const request = new Request("https://carrier.example/track", { redirect: "error" });
await wrapped(request);
assert.equal(calls.at(-1).init.redirect, "manual", "Request input error mode must also be made Cloudflare-safe");

assert.throws(() => createCloudflareFetch(null), /fetch implementation is required/);

console.log("Cloudflare fetch redirect compatibility tests passed.");
