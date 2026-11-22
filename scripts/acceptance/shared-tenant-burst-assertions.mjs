export const SUCCESS_FIXTURE = Object.freeze({
  url: "https://www.iana.org/domains/reserved",
  marker: "IANA-managed Reserved Domains",
});

export function assertSuccessfulFetchTask(task, transport) {
  const status = task?.result?.data?.httpStatus ?? task?.result?.data?.status;
  const body = task?.result?.data?.body;
  const hasBody = typeof body === "string" && body.length > 0;
  const contentMarkerMatched = hasBody && body.includes(SUCCESS_FIXTURE.marker);
  const diagnostic = {
    state: task?.state ?? null,
    resultStatus: task?.result?.status ?? null,
    upstreamStatus: Number.isInteger(status) ? status : null,
    hasBody,
    contentMarkerMatched,
    errorCodes: Array.isArray(task?.errors)
      ? task.errors
          .map((error) => error?.code)
          .filter((code) => typeof code === "string")
          .slice(0, 4)
      : [],
  };

  if (
    task?.state !== "succeeded" ||
    task?.result?.status !== "succeeded" ||
    !Number.isInteger(status) ||
    status < 200 ||
    status >= 300 ||
    !contentMarkerMatched
  ) {
    throw new Error(
      `${transport} Fetch did not complete against the reserved-domain success fixture: ${JSON.stringify(diagnostic)}`,
    );
  }

  return diagnostic;
}
