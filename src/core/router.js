const EXECUTION_PATHS = new Set(["http", "browser"]);
export function chooseExecutionPath(task = {}) {
 const path = task.requiresInteraction || task.requiresJavascript ? "browser" : "http";
 if (!EXECUTION_PATHS.has(path)) throw new TypeError("Unsupported execution path");
 return {path,reason:path==="browser"?"The task requires page rendering or user-directed interaction.":"Direct HTTP is the lightest suitable first attempt.",escalationAllowed:path==="http"};
}
