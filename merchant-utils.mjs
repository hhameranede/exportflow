const FORMULA_PREFIX = /^[\u0000-\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*[=+\-@]/;

export function escapeCsvCell(value) {
  let text = String(value ?? "");
  if (FORMULA_PREFIX.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
