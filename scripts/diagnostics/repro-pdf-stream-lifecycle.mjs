import { createSyntheticPdf } from "../../tests/fixtures/synthetic-pdf.mjs";
import { extractPdfText } from "../../src/core/pdf-parser.js";
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

const bytes = createSyntheticPdf(["ExportFlow PDF lifecycle diagnostic"]);
const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

async function phase(name, operation) {
  activePhase = name;
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
    "; unhandled=" + rejections.length + "\n");
}

await phase("direct streamTextContent + destroy", async () => {
  const document = await getDocumentProxy(bytes.slice(), {
    isEvalSupported: false,
    enableXfa: false,
    useWorkerFetch: false,
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

await phase("unpdf extractText helper", async () => {
  const result = await extractText(bytes.slice(), { mergePages: true });
  process.stdout.write("[pdf-stream-lifecycle] extractText chars=" + result.text.length + "\n");
});

await phase("ExportFlow extractPdfText", async () => {
  const result = await extractPdfText(bytes.slice(), { contentType: "application/pdf" });
  process.stdout.write("[pdf-stream-lifecycle] extractPdfText chars=" + result.text.length + "\n");
});

activePhase = "final settle window";
await pause(300);
process.stdout.write("[pdf-stream-lifecycle] final unhandled count=" + rejections.length + "\n");
