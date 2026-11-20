export function createTaskCancelledError() {
  const error = new Error("Task was cancelled by the caller.");
  error.name = "TaskCancelledError";
  error.code = "TASK_CANCELLED";
  error.httpStatus = 499;
  return error;
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw createTaskCancelledError();
}

/**
 * Stop awaiting an operation when its caller disconnects.
 * The underlying operation is only stopped if it separately honors cancellation.
 */
export function awaitWithSignal(promise, signal) {
  throwIfAborted(signal);
  if (!signal) return Promise.resolve(promise);

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const onAbort = () => settle(reject, createTaskCancelledError());

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    Promise.resolve(promise).then(
      (value) => settle(resolve, value),
      (error) => settle(reject, error),
    );
  });
}
