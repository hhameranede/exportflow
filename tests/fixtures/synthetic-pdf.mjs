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
    // Flow long synthetic text across visible lines so the fixture exercises
    // parser output limits rather than clipping at the page's right edge.
    const pageText = String(pages[index]);
    const lineLength = 60;
    const lineLeading = 8;
    const textLines = [];
    for (let offset = 0; offset < pageText.length; offset += lineLength) {
      textLines.push(pageText.slice(offset, offset + lineLength));
    }
    if (textLines.length === 0) textLines.push("");
    const pageHeight = Math.max(792, 144 + textLines.length * lineLeading);
    const textOperators = textLines.map((line, lineIndex) => {
      const move = lineIndex === 0 ? "" : "0 -" + lineLeading + " Td\n";
      return move + "(" + escapePdfText(line) + ") Tj";
    });
    const stream = "BT\n/F1 6 Tf\n72 " + (pageHeight - 72) + " Td\n" + textOperators.join("\n") + "\nET\n";
    const streamLength = Buffer.byteLength(stream, "ascii");

    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 " + pageHeight + "] /Resources << /Font << /F1 " +
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
