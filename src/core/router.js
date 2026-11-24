export function chooseExecutionPath() {
  return {
    path: "http",
    reason: "ExportFlow uses bounded static HTTP retrieval only; browser execution is not offered.",
    escalationAllowed: false,
  };
}
