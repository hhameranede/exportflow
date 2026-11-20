import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../src/index.js";
import { hashApiKey } from "../src/core/tenant-auth.js";
const KEY_ID="0123456789abcdef";
const TOKEN="ef_live_"+KEY_ID+"_"+"R".repeat(43);
const KEY_HASH=await hashApiKey(TOKEN);
function makeAuthDb({keyExists=true,schemaExists=true}={}){
 const counts={keyLookups:0,quotaSchemaProbes:0};
 const row={key_id:KEY_ID,tenant_id:"tenant_security_test",key_status:"active",expires_at:null,scopes_json:'["tasks:fetch"]',tenant_status:"active",plan_code:"test",plan_status:"active",quota_period:"daily",request_limit:10,policy_version:"test-v1"};
 return {counts,prepare(sql){let params=[];return {bind(...values){params=values;return this;},async first(){
  if(sql.includes("tenant_request_usage LIMIT 0")){counts.quotaSchemaProbes++;if(!schemaExists)throw new Error("synthetic missing quota table");return null;}
  if(sql.includes("FROM api_keys")){counts.keyLookups++;return keyExists&&params[0]===KEY_ID&&params[1]===KEY_HASH?{...row}:null;}
  throw new Error("Unexpected SQL in security test fixture.");
 }};}};
}
test("public platform discovery returns metadata without querying D1",async()=>{
 const db=makeAuthDb(),worker=createWorker();
 const response=await worker.fetch(new Request("https://exportflow.local/api/v1/platform"),{EXPORTFLOW_AUTH_DB:db});
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.auth.configured,true);assert.equal(body.auth.ready,false);
 assert.deepEqual(body.liveCapabilities,[]);assert.deepEqual(db.counts,{keyLookups:0,quotaSchemaProbes:0});
});
test("authenticated platform readiness probes schema only after key validation",async()=>{
 const db=makeAuthDb(),worker=createWorker();
 const response=await worker.fetch(new Request("https://exportflow.local/api/v1/platform",{headers:{authorization:"Bearer "+TOKEN}}),{EXPORTFLOW_AUTH_DB:db});
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.auth.ready,true);assert.deepEqual(body.liveCapabilities,["http.fetch.v1"]);
 assert.deepEqual(db.counts,{keyLookups:1,quotaSchemaProbes:1});
});
test("invalid API keys do not reach quota schema readiness queries",async()=>{
 const db=makeAuthDb({keyExists:false}),worker=createWorker();
 const response=await worker.fetch(new Request("https://exportflow.local/api/v1/platform",{headers:{authorization:"Bearer "+TOKEN}}),{EXPORTFLOW_AUTH_DB:db});
 assert.equal(response.status,401);assert.equal((await response.json()).error.code,"INVALID_TOKEN");
 assert.deepEqual(db.counts,{keyLookups:1,quotaSchemaProbes:0});
});
test("pre-auth limiter stops requests before D1 API-key lookup",async()=>{
 const db=makeAuthDb();let observedKey=null;
 const worker=createWorker({preAuthRateLimiter:{check(key){observedKey=key;return {allowed:false,retryAfterSec:7};}}});
 const request=new Request("https://exportflow.local/api/v1/tasks",{method:"POST",headers:{authorization:"Bearer "+TOKEN,"content-type":"application/json","cf-connecting-ip":"203.0.113.42"},body:JSON.stringify({goal:"Fetch",url:"https://example.com"})});
 const response=await worker.fetch(request,{EXPORTFLOW_AUTH_DB:db});
 assert.equal(response.status,429);assert.equal(response.headers.get("retry-after"),"7");assert.equal(observedKey,"ip:203.0.113.42");
 assert.deepEqual(db.counts,{keyLookups:0,quotaSchemaProbes:0});
});
