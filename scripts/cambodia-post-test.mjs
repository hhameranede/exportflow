import assert from "node:assert/strict";
import {
  cambodiaPostStage,
  createCambodiaPostAdapter,
  isCambodiaPostNumber,
  parseCambodiaPostHtml,
  parseCambodiaPostTime,
  readCambodiaPostBody
} from "../functions/lib/cambodia-post.mjs";
import { trackCustomCarrier } from "../functions/lib/custom-carriers.mjs";
import {
  ChallengeError,
  InvalidInputError,
  NotFoundError,
  RateLimitedError,
  SchemaError
} from "../node_modules/universal-parcel-scraper/dist/core/errors/index.js";

assert.equal(isCambodiaPostNumber("RR123456789KH"), true);
assert.equal(isCambodiaPostNumber("RR123456789US"), false);
assert.equal(parseCambodiaPostTime("2026-11-05 09:35"), "2026-11-05T09:35:00+07:00");
assert.equal(parseCambodiaPostTime("05/11/2026 09:35"), "2026-11-05T09:35:00+07:00");
assert.equal(parseCambodiaPostTime("2026-02-31 09:35"), null, "impossible dates must not be normalized into a different day");
assert.equal(cambodiaPostStage("Item delivered to recipient"), "delivered");
assert.equal(cambodiaPostStage("Arrived at sorting centre"), "in_transit");

const smallBody = await readCambodiaPostBody(new Response("bounded"));
assert.equal(smallBody, "bounded");
await assert.rejects(
  readCambodiaPostBody(new Response("x".repeat(1_000_001))),
  SchemaError,
  "oversized response bodies must be rejected"
);

const fixture = `
<!doctype html><html><body>
<h2>Item No RR123456789KH</h2>
<table><thead><tr><th>Date</th><th>Country</th><th>Location</th><th>Event Type</th><th>Mail Type</th><th>Next Office</th><th>Information</th></tr></thead>
<tbody>
<tr><td>2026-11-04 10:10</td><td>Cambodia</td><td>Phnom Penh</td><td>Posted</td><td>Registered</td><td>Sorting Centre</td><td>Item accepted</td></tr>
<tr><td>2026-11-05 09:35</td><td>Cambodia</td><td>Siem Reap</td><td>Delivered</td><td>Registered</td><td></td><td>Received by recipient</td></tr>
</tbody></table></body></html>`;
const parsed = parseCambodiaPostHtml(fixture, "RR123456789KH");
assert.equal(parsed.current_stage, "delivered");
assert.equal(parsed.events.length, 2);
assert.equal(parsed.events[0].time, "2026-11-04T10:10:00+07:00");
assert.equal(parsed.events[1].location, "Cambodia · Siem Reap");
assert.throws(() => parseCambodiaPostHtml("<html><body>Not Found</body></html>", "RR123456789KH"), NotFoundError);
assert.throws(() => parseCambodiaPostHtml("<html><body>Just a moment... cf-chl challenge</body></html>", "RR123456789KH"), ChallengeError);
assert.throws(() => parseCambodiaPostHtml("<html><body>No table data</body></html>", "RR123456789KH"), SchemaError);

let requestedUrl = "";
const fakeFetcher = async (url) => {
  requestedUrl = String(url);
  return new Response(fixture, { status: 200, headers: { "Content-Type": "text/html" } });
};
const adapter = createCambodiaPostAdapter({ fetcher: fakeFetcher });
const result = await adapter.track({ number: "RR123456789KH" }, { budgetMs: 1000 });
assert.match(requestedUrl, /\/RR123456789KH$/);
assert.equal(result.current_stage, "delivered");
const registeredResult = await trackCustomCarrier("cambodia-post", {
  number: "RR123456789KH"
}, { budgetMs: 1000 }, fakeFetcher);
assert.equal(registeredResult.current_stage, "delivered", "custom adapter should dispatch through the upstream registry extension");
await assert.rejects(adapter.track({ number: "RR123456789US" }), InvalidInputError);

const throttled = createCambodiaPostAdapter({
  fetcher: async () => new Response("slow down", { status: 429, headers: { "Retry-After": "30" } })
});
await assert.rejects(throttled.track({ number: "RR123456789KH" }), error => error instanceof RateLimitedError && error.retryAfterMs === 30000);

console.log("Cambodia Post custom adapter tests passed.");
