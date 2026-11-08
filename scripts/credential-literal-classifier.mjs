const LITERAL_PATTERN = /(api[_-]?key|client[_-]?secret|password|access[_-]?token)\\s*[:=]\\s*(['"])([^'"]{12,})\\2/ig;

function sourceKind(path) {
  const normalized = String(path || "").replaceAll("\\\\", "/");
  if (/(^|\\/)fixtures?(\\/|$)|\\.(html|fixture)\\.(json|txt)$/i.test(normalized)) return "fixture";
  if (/\\.(test|spec)\\.(ts|tsx|js|mjs|cjs)$/i.test(normalized)) return "test";
  return "runtime";
}

/**
 * Locate credential-like string assignments without retaining their values.
 * This is a static heuristic, not proof that a value is a secret or valid.
 */
export function classifyCredentialLiteralFindings(files) {
  const findings = [];
  for (const file of files || []) {
    const path = String(file?.path || "");
    const kind = sourceKind(path);
    const lines = String(file?.content || "").split(/\\r?\\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      LITERAL_PATTERN.lastIndex = 0;
      for (const match of line.matchAll(LITERAL_PATTERN)) {
        findings.push({
          file: path,
          line: index + 1,
          field: match[1].toLowerCase(),
          sourceKind: kind,
          valueLength: match[3].length
        });
      }
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.field.localeCompare(b.field));
}
