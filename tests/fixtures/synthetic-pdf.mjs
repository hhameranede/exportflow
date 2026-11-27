function escapePdfText(value) {
  return String(value)
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Builds a tiny, valid ASCII-only PDF fixture with no external resources.
 * Each page uses a built-in Helvetica font and contains only supplied text.
 */
export function createSyntheticPdf(pages = ["ExportFlow synthetic PDF fixture"]) {
  if (!Array.isArray(pages) || pages.length < 1) {
    throw new TypeError("pages must contain at least one string.");
  }

  const pageIds = pages.map((_, index) => 3 + index * 2);
  const fontId = 3 + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [" + pageIds.map((id) => id + " 0 R").join(" ") + "] /Count " + pages.length + " >>",
  ];

  for (let index = 0; index < pages.length; index += 1) {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const stream = "BT\n/F1 12 Tf\n72 720 Td\n(" + escapePdfText(pages[index]) + ") Tj\nET\n";
    const streamLength = Buffer.byteLength(stream, "ascii");

    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 " +
        fontId + " 0 R >> >> /Contents " + contentId + " 0 R >>",
    );
    objects.push("<< /Length " + streamLength + " >>\nstream\n" + stream + "endstream");
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += (index + 1) + " 0 obj\n" + objects[index] + "\nendobj\n";
  }

  const xrefOffset = Buffer.byteLength(output, "ascii");
  output += "xref\n0 " + (objects.length + 1) + "\n";
  output += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += String(offset).padStart(10, "0") + " 00000 n \n";
  }
  output += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\n";
  output += "startxref\n" + xrefOffset + "\n%%EOF\n";
  return new Uint8Array(Buffer.from(output, "ascii"));
}
