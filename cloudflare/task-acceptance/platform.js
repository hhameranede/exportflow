import { createWorker, TenantBurstRateLimiter } from "../../src/index.js";

export { TenantBurstRateLimiter };

export default createWorker({
  tenantBurstLimit: 100,
  tenantBurstWindowMs: 60_000,
  acceptanceNetworkProbe: true,
});
