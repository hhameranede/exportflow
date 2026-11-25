import { executeWebTask } from "../../src/core/tasks.js";
import { getAdapterCatalog } from "../../src/core/adapters.js";
import { createExportFlowPreviewWorker } from "../../src/mcp/preview-worker.js";

export default createExportFlowPreviewWorker({
  executeWebTask,
  getAdapterCatalog,
  tenantBurstLimit: 100,
  tenantBurstWindowMs: 60_000,
});
