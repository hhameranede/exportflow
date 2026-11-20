import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
let DatabaseSync;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch {}
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const migration1=readFileSync(join(root,"migrations","0001_tenant_auth_quota.sql"),"utf8");
const migration2=readFileSync(join(root,"migrations","0002_guard_quota_period_transitions.sql"),"utf8");
test("quota-period migration blocks mid-month switches and permits a new period after prior-month usage",{skip:!DatabaseSync},()=>{
 const db=new DatabaseSync(":memory:");
 try {
  db.exec("PRAGMA foreign_keys=ON;");db.exec(migration1);db.exec(migration2);
  const now=new Date(),today=now.toISOString().slice(0,10);
  const first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));first.setUTCDate(0);
  const previousMonthDay=first.toISOString().slice(0,10);
  const addPlan=db.prepare("INSERT INTO plan_policies (plan_code,quota_period,request_limit,policy_version,status,created_at,updated_at) VALUES (?, ?, 3, 'v1','active',?,?)");
  addPlan.run("daily","daily",now.toISOString(),now.toISOString());addPlan.run("daily-alt","daily",now.toISOString(),now.toISOString());addPlan.run("monthly","monthly",now.toISOString(),now.toISOString());
  db.prepare("INSERT INTO tenants (tenant_id,plan_code,status,created_at,updated_at) VALUES ('tenant-a','daily','active',?,?)").run(now.toISOString(),now.toISOString());
  db.prepare("INSERT INTO tenant_request_usage (tenant_id,window_id,plan_code,policy_version,request_limit,requests_used,updated_at) VALUES ('tenant-a',?,'daily','v1',3,1,?)").run(today,now.toISOString());
  assert.throws(()=>db.prepare("UPDATE plan_policies SET quota_period='monthly' WHERE plan_code='daily'").run(),/PLAN_QUOTA_PERIOD_IMMUTABLE_UNTIL_NEXT_UTC_MONTH/);
  assert.throws(()=>db.prepare("UPDATE tenants SET plan_code='monthly' WHERE tenant_id='tenant-a'").run(),/TENANT_QUOTA_PERIOD_IMMUTABLE_UNTIL_NEXT_UTC_MONTH/);
  db.prepare("UPDATE tenants SET plan_code='daily-alt' WHERE tenant_id='tenant-a'").run();
  db.prepare("DELETE FROM tenant_request_usage WHERE tenant_id='tenant-a'").run();
  db.prepare("INSERT INTO tenant_request_usage (tenant_id,window_id,plan_code,policy_version,request_limit,requests_used,updated_at) VALUES ('tenant-a',?,'daily-alt','v1',3,1,?)").run(previousMonthDay,now.toISOString());
  db.prepare("UPDATE tenants SET plan_code='monthly' WHERE tenant_id='tenant-a'").run();
 } finally { db.close(); }
});
