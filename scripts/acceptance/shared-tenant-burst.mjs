import { createHash, randomBytes, randomUUID } from "node:crypto";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const databaseId = "1f94eee0-219e-4a41-86ce-49c29067ef06";
const platformUrl = "https://exportflow-tenant-platform-acceptance-20261122.hhameranede.workers.dev";
const mcpUrl = "https://exportflow-tenant-mcp-acceptance-20261122.hhameranede.workers.dev/mcp";
const createdTenantIds = [];
const createdKeyIds = [];
if (!accountId || !apiToken) throw new Error("Acceptance D1 credentials are not configured.");
function sqlString(value) { return "'" + String(value).replaceAll("'", "''") + "'"; }
async function d1(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, { method:"POST", headers:{authorization:`Bearer ${apiToken}`,"content-type":"application/json"}, body:JSON.stringify({sql}) });
  let body; try { body=await response.json(); } catch { throw new Error("Acceptance D1 returned non-JSON."); }
  if (!response.ok || body?.success !== true) throw new Error(`Acceptance D1 query failed (HTTP ${response.status}): ${body?.errors?.[0]?.message || "query failed"}`);
  return body.result?.[0]?.results ?? [];
}
async function jsonRequest(url, init) {
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(20_000)});
  const text=await response.text(); let body; try{body=text?JSON.parse(text):{};}catch{throw new Error(`Expected JSON from ${url}; HTTP ${response.status}.`);}
  return {response,body};
}
function createCredential(){const keyId=randomBytes(12).toString("base64url");const token=`ef_live_${keyId}_${randomBytes(32).toString("base64url")}`;const keyHash=createHash("sha256").update("exportflow-api-key-v1:"+token).digest("hex");return{keyId,token,keyHash};}
async function seedTenant(label){const tenantId=`qa_shared_do_${randomUUID().replaceAll("-","")}`;const c=createCredential();const now=new Date().toISOString();createdTenantIds.push(tenantId);createdKeyIds.push(c.keyId);await d1(`INSERT INTO tenants (tenant_id,plan_code,status,created_at,updated_at) VALUES (${sqlString(tenantId)},'qa_daily','active',${sqlString(now)},${sqlString(now)})`);await d1(`INSERT INTO api_keys (key_id,tenant_id,key_hash,status,scopes_json,expires_at,created_at,revoked_at) VALUES (${sqlString(c.keyId)},${sqlString(tenantId)},${sqlString(c.keyHash)},'active','["tasks:fetch"]',NULL,${sqlString(now)},NULL)`);return{label,tenantId,token:c.token};}
async function restCall(token){const{response,body}=await jsonRequest(platformUrl+"/api/v1/tasks",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json",accept:"application/json"},body:JSON.stringify({goal:"Acceptance shared tenant burst check",url:"https://example.com/robots.txt"})});return{status:response.status,body};}
async function mcpCall(token,id){const{response,body}=await jsonRequest(mcpUrl,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json",accept:"application/json, text/event-stream","mcp-protocol-version":"2025-11-25"},body:JSON.stringify({jsonrpc:"2.0",id,method:"tools/call",params:{name:"web_fetch",arguments:{url:"https://example.com/robots.txt"}}})});return{status:response.status,body};}
async function assertOneUsage(tenantId){const rows=await d1(`SELECT window_id,request_limit,requests_used FROM tenant_request_usage WHERE tenant_id=${sqlString(tenantId)}`);if(rows.length!==1||Number(rows[0].requests_used)!==1)throw new Error("Expected exactly one persisted D1 quota reservation for a cross-transport test tenant.");return{windowId:rows[0].window_id,requestLimit:Number(rows[0].request_limit),requestsUsed:Number(rows[0].requests_used)};}
async function testRestThenMcp(tenant){const first=await restCall(tenant.token);if(first.status!==200||!first.body?.id||!["succeeded","partial","failed"].includes(first.body?.state))throw new Error(`REST-first request was not accepted (HTTP ${first.status}).`);const second=await mcpCall(tenant.token,"rest-then-mcp");const result=second.body?.result?.structuredContent;if(second.status!==200||second.body?.result?.isError!==true||result?.error!=="RATE_LIMITED")throw new Error("MCP did not observe the REST tenant's shared Durable Object reservation.");return{order:"REST then MCP",restStatus:first.status,restTaskState:first.body.state,mcpStatus:second.status,mcpError:result.error,persistedQuota:await assertOneUsage(tenant.tenantId)};}
async function testMcpThenRest(tenant){const first=await mcpCall(tenant.token,"mcp-then-rest");const result=first.body?.result?.structuredContent;const quota=result?.quota;if(first.status!==200||!["succeeded","partial","failed"].includes(result?.state)||!quota||Number(quota.limit)<1||Number(quota.remaining)<0){const diagnostic={httpStatus:first.status,isError:first.body?.result?.isError===true,error:result?.error||null,state:result?.state||null,hasQuota:Boolean(quota),message:result?.message||null};throw new Error("MCP-first request did not reach an authenticated quota-reserved task response: "+JSON.stringify(diagnostic));}const second=await restCall(tenant.token);if(second.status!==429||second.body?.error?.code!=="RATE_LIMITED")throw new Error("REST did not observe the MCP tenant's shared Durable Object reservation.");return{order:"MCP then REST",mcpStatus:first.status,mcpTaskState:result.state,mcpTaskIsError:first.body?.result?.isError===true,quotaReserved:quota,restStatus:second.status,restError:second.body.error.code,persistedQuota:await assertOneUsage(tenant.tenantId)};}
async function cleanupSyntheticRows(){if(createdTenantIds.length){const list=createdTenantIds.map(sqlString).join(",");await d1(`DELETE FROM tenant_request_usage WHERE tenant_id IN (${list})`);await d1(`DELETE FROM api_keys WHERE tenant_id IN (${list})`);await d1(`DELETE FROM tenants WHERE tenant_id IN (${list})`);const left=await d1(`SELECT (SELECT COUNT(*) FROM tenants WHERE tenant_id IN (${list})) AS tenants,(SELECT COUNT(*) FROM api_keys WHERE tenant_id IN (${list})) AS api_keys,(SELECT COUNT(*) FROM tenant_request_usage WHERE tenant_id IN (${list})) AS usage`);if(Number(left[0]?.tenants)||Number(left[0]?.api_keys)||Number(left[0]?.usage))throw new Error("Synthetic D1 rows were not fully cleaned up.");}return{tenants:createdTenantIds.length,apiKeys:createdKeyIds.length,remainingRows:0};}
let primaryError=null;
try{
 const policies=await d1("SELECT plan_code,status,quota_period,request_limit FROM plan_policies WHERE plan_code='qa_daily' LIMIT 1");
 if(policies.length!==1||policies[0].status!=="active"||Number(policies[0].request_limit)<1)throw new Error("Existing QA-only daily plan policy is not active; no policy was changed.");
 const health=await Promise.all([jsonRequest(platformUrl+"/api/v1/health",{headers:{accept:"application/json"}}),jsonRequest(mcpUrl.replace(/\/mcp$/,"")+"/health",{headers:{accept:"application/json"}})]);
 if(health.some(x=>x.response.status!==200||x.body?.status!=="ok"))throw new Error("One or both Acceptance Workers failed health checks.");
 const restFirst=await seedTenant("rest-first"),mcpFirst=await seedTenant("mcp-first");
 const results=[await testRestThenMcp(restFirst),await testMcpThenRest(mcpFirst)];
 console.log(JSON.stringify({acceptance:"shared-rest-mcp-durable-object-tenant-burst",status:"passed",workers:{platform:platformUrl,mcp:mcpUrl},policy:{planCode:"qa_daily",quotaPeriod:policies[0].quota_period,requestLimit:Number(policies[0].request_limit)},tests:results,credentials:"synthetic API keys generated in memory; only SHA-256 hashes stored; raw tokens never logged or persisted"}));
}catch(error){primaryError=error;}finally{try{console.log("Acceptance synthetic D1 cleanup: "+JSON.stringify(await cleanupSyntheticRows()));}catch(error){if(!primaryError)primaryError=error;console.error("Acceptance D1 cleanup failed: "+error.message);}}
if(primaryError)throw primaryError;
