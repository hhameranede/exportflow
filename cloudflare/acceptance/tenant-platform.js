import { createWorker, TenantBurstRateLimiter } from "../../src/index.js";
export { TenantBurstRateLimiter };
export default createWorker({ tenantBurstLimit: 1, tenantBurstWindowMs: 60_000 });
