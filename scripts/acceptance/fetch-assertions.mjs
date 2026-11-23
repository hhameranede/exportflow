const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const TASK_STATES = new Set(["succeeded", "partial", "failed", "unsupported", "cancelled"]);
const RESULT_STATES = new Set(["succeeded", "partial", "failed"]);

function safeCode(value) {
  return typeof value === "string" && SAFE_CODE.test(value) ? value : null;
}

function sourceHostVerified(sources, expectedHost) {
  if (!Array.isArray(sources) || typeof expectedHost !== "string" || !expectedHost) return false;
  const normalizedHost = expectedHost.toLowerCase();
  return sources.some((source) => {
    if (typeof source?.url !== "string") return false;
    try {
      const url = new URL(source.url);
      return url.protocol === "https:" &&
        (url.hostname === normalizedHost || url.hostname.endsWith("." + normalizedHost));
    } catch {
      return false;
    }
  });
}

export function getSafeFetchDiagnostic({
  transport,
  httpStatus,
  task,
  toolIsError = false,
  expectedContent,
  expectedHost,
} = {}) {
  const data = task?.result?.data;
  const body = typeof data?.body === "string" ? data.body : "";
  const taskErrorCodes = Array.isArray(task?.errors)
    ? task.errors.map((error) => safeCode(error?.code)).filter(Boolean).slice(0, 5)
    : [];
  const sources = task?.result?.sources;

  return {
    transport: transport === "MCP" ? "MCP" : "REST",
    transportHttpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    toolIsError: toolIsError === true,
    taskState: TASK_STATES.has(task?.state) ? task.state : "unknown",
    resultStatus: RESULT_STATES.has(task?.result?.status) ? task.result.status : "unknown",
    upstreamHttpStatus: Number.isInteger(data?.httpStatus)
      ? data.httpStatus
      : Number.isInteger(data?.status) ? data.status : null,
    resultErrorCode: safeCode(data?.errorCode),
    taskErrorCodes,
    bodyBytes: Number.isInteger(data?.bytes) ? data.bytes : body.length,
    expectedContentPresent: typeof expectedContent === "string" && expectedContent.length > 0
      ? body.includes(expectedContent)
      : false,
    sourceCount: Array.isArray(sources) ? sources.length : 0,
    sourceHostVerified: sourceHostVerified(sources, expectedHost),
  };
}

export function assertSuccessfulFetchTask(options = {}) {
  const diagnostic = getSafeFetchDiagnostic(options);
  const failures = [];

  if (diagnostic.transportHttpStatus !== 200) failures.push("transport_http_status");
  if (diagnostic.toolIsError) failures.push("mcp_tool_error");
  if (diagnostic.taskState !== "succeeded") failures.push("task_state");
  if (diagnostic.resultStatus !== "succeeded") failures.push("result_status");
  if (diagnostic.upstreamHttpStatus !== 200) failures.push("upstream_http_status");
  if (diagnostic.bodyBytes <= 0) failures.push("empty_response_body");
  if (!diagnostic.expectedContentPresent) failures.push("expected_content_missing");
  if (!diagnostic.sourceHostVerified) failures.push("source_provenance");

  if (failures.length > 0) {
    throw new Error(
      diagnostic.transport +
      " Fetch acceptance failed (" + failures.join(", ") + "): " +
      JSON.stringify(diagnostic),
    );
  }

  return {
    transport: diagnostic.transport,
    taskState: diagnostic.taskState,
    resultStatus: diagnostic.resultStatus,
    transportHttpStatus: diagnostic.transportHttpStatus,
    upstreamHttpStatus: diagnostic.upstreamHttpStatus,
    responseBytes: diagnostic.bodyBytes,
    expectedContentVerified: diagnostic.expectedContentPresent,
    sourceHostVerified: diagnostic.sourceHostVerified,
    sourceCount: diagnostic.sourceCount,
  };
}
