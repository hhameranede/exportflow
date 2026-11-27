// Diagnostic-only preload for the PDF parser CI race.
// It logs the original stack but deliberately does not consume or suppress
// unhandled rejections, so node:test keeps failing when the race is present.
process.on("unhandledRejection", (reason) => {
  const detail = reason instanceof Error
    ? (reason.stack || reason.message)
    : String(reason);
  process.stderr.write("[pdf-parser-async-diagnostic] unhandledRejection\n" + detail + "\n");
});

process.on("uncaughtExceptionMonitor", (error) => {
  process.stderr.write("[pdf-parser-async-diagnostic] uncaughtExceptionMonitor\n" +
    (error?.stack || String(error)) + "\n");
});
