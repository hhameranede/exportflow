import { createSyntheticPdf } from "../../tests/fixtures/synthetic-pdf.mjs";
import { extractPdfText, PDF_PARSE_LIMITS } from "../../src/core/pdf-parser.js";
import { extractText, getDocumentProxy } from "unpdf";

let activePhase = "startup";
const rejections = [];
process.on("unhandledRejection", (reason) => {
  const entry = {
    phase: activePhase,
    name: reason?.name || typeof reason,
    message: reason?.message || String(reason),
    stack: reason?.stack || null,
  };
  rejections.push(entry);
  process.stderr.write("[pdf-stream-lifecycle] " + JSON.stringify(entry) + "\n");
});

const smallBytes = createSyntheticPdf(["ExportFlow PDF lifecycle diagnostic"]);
const largeBytes = createSyntheticPdf(["A".repeat(PDF_PARSE_LIMITS.maxOutputCharacters + 1024)]);
const pause = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms));

async function phase(name, operation) {
  activePhase = name;
  const before = rejections.length;
  process.stdout.write("[pdf-stream-lifecycle] start " + name + "\n");
  try {
    await operation();
    process.stdout.write("[pdf-stream-lifecycle] success " + name + "\n");
  } catch (error) {
    process.stdout.write("[pdf-stream-lifecycle] rejected " + name + ": " +
      (error?.stack || String(error)) + "\n");
  }
  activePhase = name + " (post-operation settle window)";
  await pause();
  process.stdout.write("[pdf-stream-lifecycle] settle " + name +
    "; newUnhandled=" + (rejections.length - before) + "; total=" + rejections.length + "\n");
}

await phase("direct streamTextContent + destroy (small PDF)", async () => {
  const document = await getDocumentProxy(smallBytes.slice(), {
    isEvalSupported: false, enableXfa: false, useWorkerFetch: false,
  });
  try {
    const page = await document.getPage(1);
    const reader = page.streamTextContent().getReader();
    while (true) {
      const result = await reader.read();
      if (result.done) break;
    }
    reader.releaseLock();
  } finally {
    await document.loadingTask.destroy();
  }
});

await phase("unpdf extractText helper (small PDF)", async () => {
  const result = await extractText(smallBytes.slice(), { mergePages: true });
  process.stdout.write("[pdf-stream-lifecycle] chars=" + result.text.length + "\n");
});

await phase("ExportFlow extractPdfText (small PDF)", async () => {
  const result = await extractPdfText(smallBytes.slice(), { contentType: "application/pdf" });
  process.stdout.write("[pdf-stream-lifecycle] chars=" + result.text.length + "\n");
});

await phase("ExportFlow extractPdfText (large PDF triggers output cap and reader.cancel)", async () => {
  const result = await extractPdfText(largeBytes.slice(), { contentType: "application/pdf" });
  process.stdout.write("[pdf-stream-lifecycle] chars=" + result.text.length +
    " truncated=" + result.truncated + "\n");
});

await phase("unpdf extractText helper (large PDF without early cancel)", async () => {
  const result = await extractText(largeBytes.slice(), { mergePages: true });
  process.stdout.write("[pdf-stream-lifecycle] chars=" + result.text.length + "\n");
});

activePhase = "final settle window";
await pause(350);
process.stdout.write("[pdf-stream-lifecycle] final unhandled count=" + rejections.length + "\n");
