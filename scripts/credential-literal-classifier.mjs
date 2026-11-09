const LITERAL_PATTERN = /(?:["']?)(api[_-]?key|client[_-]?secret|password|access[_-]?token)(?:["']?)\s*[:=]\s*(["'])([^"']{12,})\2/ig;

/**
 * Classify adapter files by path. Fixture paths take precedence so a fixture
 * nested beneath a test directory is never reported as runtime source.
 */
export function classifyAdapterSourceKind(path) {
  const normalized = String(path || "").replaceAll("\\", "/");
  const segments = normalized.split("/").filter(Boolean);

  const isFixture = segments.some(segment => /^(?:fixtures?|__fixtures__)$/i.test(segment)) ||
    /\.(?:fixture)\.(?:ts|tsx|js|mjs|cjs|json|html|txt)$/i.test(normalized);
  if (isFixture) return "fixture";

  const isTest = segments.some(segment => /^(?:__tests__|tests?|specs?)$/i.test(segment)) ||
    /\.(?:test|spec)\.(?:ts|tsx|js|mjs|cjs)$/i.test(normalized);
  if (isTest) return "test";

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
    const kind = classifyAdapterSourceKind(path);
    const lines = String(file?.content || "").split(/\r?\n/);
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
