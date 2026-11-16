import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/merchant/carrier-catalog.js";

const response = await onRequestGet();
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=3600");
const body = await response.json();
assert.equal(body.source, "installed-exportflow-direct-adapters");
assert.equal(body.count, body.carriers.length);
assert.ok(body.count > 200, "Merchant catalog must expose the installed direct-adapter set, not only UPS and FedEx");
assert.ok(body.carriers.some(carrier => carrier.id === "ups"));
assert.ok(body.carriers.some(carrier => carrier.id === "fedex"));
assert.ok(body.carriers.some(carrier => carrier.id === "algerie-poste"));
assert.ok(body.carriers.every(carrier =>
  carrier.id !== "unknown" &&
  carrier.adapter &&
  carrier.adapter !== "universal" &&
  Array.isArray(carrier.requirements)
));
assert.ok(body.carriers.every(carrier =>
  carrier.requirements.every(requirement =>
    ["trackingUrl", "postcode"].includes(requirement.field) &&
    typeof requirement.label === "string"
  )
));
console.log("Merchant direct-carrier catalog tests passed:", body.count, "selectable direct adapters.");
