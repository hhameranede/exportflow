export function chooseExecutionPath() {
  return {
    path: "http",
    reason: "ExportFlow uses bounded public HTTP request execution only.",
    escalationAllowed: false,
  };
}
