-- Prevent switching daily/monthly window IDs mid-month after quota was consumed.
CREATE TRIGGER IF NOT EXISTS prevent_mid_month_plan_quota_period_change
BEFORE UPDATE OF quota_period ON plan_policies
WHEN OLD.quota_period <> NEW.quota_period
 AND EXISTS (
   SELECT 1 FROM tenants AS t
   JOIN tenant_request_usage AS u ON u.tenant_id=t.tenant_id
   WHERE t.plan_code=OLD.plan_code
     AND substr(u.window_id,1,7)=strftime('%Y-%m','now')
 )
BEGIN
 SELECT RAISE(ABORT,'PLAN_QUOTA_PERIOD_IMMUTABLE_UNTIL_NEXT_UTC_MONTH');
END;

CREATE TRIGGER IF NOT EXISTS prevent_mid_month_tenant_plan_period_change
BEFORE UPDATE OF plan_code ON tenants
WHEN OLD.plan_code <> NEW.plan_code
 AND EXISTS (
   SELECT 1 FROM tenant_request_usage AS u
   JOIN plan_policies AS old_policy ON old_policy.plan_code=OLD.plan_code
   JOIN plan_policies AS new_policy ON new_policy.plan_code=NEW.plan_code
   WHERE u.tenant_id=OLD.tenant_id
     AND substr(u.window_id,1,7)=strftime('%Y-%m','now')
     AND old_policy.quota_period <> new_policy.quota_period
 )
BEGIN
 SELECT RAISE(ABORT,'TENANT_QUOTA_PERIOD_IMMUTABLE_UNTIL_NEXT_UTC_MONTH');
END;
