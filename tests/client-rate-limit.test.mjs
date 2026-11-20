import test from "node:test";
import assert from "node:assert/strict";
import { getClientRateLimitKey } from "../src/core/client-rate-limit.js";
test("client limiter keys use the Cloudflare IP and normalize IPv4/IPv6",()=>{
 const v6=new Request("https://api.exportflow.local/api/v1/tasks",{headers:{"cf-connecting-ip":"2001:DB8::1","x-forwarded-for":"198.51.100.77","x-real-ip":"203.0.113.8"}});
 assert.equal(getClientRateLimitKey(v6),"ip:2001:db8::1");
 const v4=new Request("https://api.exportflow.local/api/v1/tasks",{headers:{"cf-connecting-ip":"203.0.113.42"}});
 assert.equal(getClientRateLimitKey(v4),"ip:203.0.113.42");
});
test("client limiter ignores forwarded headers and rejects malformed IP values",()=>{
 const forged=new Request("https://api.exportflow.local/api/v1/tasks",{headers:{"x-forwarded-for":"198.51.100.77","x-real-ip":"203.0.113.8"}});
 assert.equal(getClientRateLimitKey(forged),"ip:unavailable");
 for(const address of ["not-an-ip","999.999.999.999","203.000.113.42","2001:::1","[2001:db8::1]"]){
  const req=new Request("https://api.exportflow.local/api/v1/tasks",{headers:{"cf-connecting-ip":address}});
  assert.equal(getClientRateLimitKey(req),"ip:unavailable",address);
 }
});
