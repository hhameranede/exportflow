import assert from "node:assert/strict";
import test from "node:test";
import { createDurableTaskD1 } from "./helpers/durable-task-d1.js";
import { executeDurableTask, getDurableTask } from "../src/core/task-store.js";

const FIXED_TIME = "2026-11-24T10:00:00.000Z";
const identity = Object.freeze({
  tenantId: "tenant_alpha",
  planCode: "developer",
  policyVersion: "test-v1",
  quotaPeriod: "daily",
  requestLimit: 10,
  scopes: ["tasks:fetch", "tasks:read"],
});

function makeInput(overrides = {}) {
  return {
    goal: "Fetch a public page",
    operation: "fetch",
    url: "https://example.com/",
    ...overrides,
  };
}

function makeExecutor({ state = "succeeded", resultBody = "ok" } = {}) {
  let calls = 0;
  const executeTask = async (input, options) => {
    calls += 1;
    const completedAt = FIXED_TIME;
    return {
      id: options.idFactory(),
      goal: input.goal,
      requestedUrl: input.url || null,
      state,
      execution: { path: "request", operation: input.operation, adapterId: "http.fetch.v1" },
      timestamps: { createdAt: FIXED_TIME, startedAt: FIXED_TIME, completedAt },
      usage: { durationMs: 5, requestsAttempted: 1, responseBytes: resultBody.length, cost: null },
      events: [
        { type: "task.accepted", at: FIXED_TIME },
        { type: "task.started", at: FIXED_TIME },
        { type: state === "succeeded" ? "task.succeeded" : "task.failed", at: FIXED_TIME },
      ],
      errors: state === "succeeded" ? [] : [{ code: "TASK_EXECUTION_FAILED", message: "Task execution failed." }],
      result: { status: state === "succeeded" ? "succeeded" : "failed", data: { body: resultBody }, sources: [], warnings: [] },
    };
  };
  return { executeTask, get calls() { return calls; } };
}

function runOptions(fixture, executor, extras = {}) {
  return {
    db: fixture.db,
    identity,
    input: makeInput(),
    idempotencyKey: "task-retry-key-0001",
    executeTask: executor.executeTask,
    now: () => FIXED_TIME,
    idFactory: () => "task_alpha_0001",
    ...extras,
  };
}

test("new task acceptance atomically writes one quota reservation and lifecycle events", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  try {
    const accepted = await executeDurableTask(runOptions(fixture, executor));
    assert.equal(accepted.ok, true);
    assert.equal(accepted.replayed, false);
    assert.equal(accepted.task.id, "task_alpha_0001");
    assert.equal(accepted.task.state, "succeeded");
    assert.equal(accepted.task.quota.used, 1);
    assert.equal(accepted.task.quota.remaining, 9);
    assert.equal(executor.calls, 1);

    const usage = fixture.sqlite.prepare(
      "SELECT requests_used FROM tenant_request_usage WHERE tenant_id = 'tenant_alpha' AND window_id = '2026-11-24'",
    ).get();
    assert.equal(usage.requests_used, 1);

    const events = fixture.sqlite.prepare(
      "SELECT event_type FROM task_events WHERE tenant_id = 'tenant_alpha' AND task_id = 'task_alpha_0001' ORDER BY revision",
    ).all().map((row) => row.event_type);
    assert.deepEqual(events, ["task.accepted", "task.started", "task.succeeded"]);
  } finally {
    fixture.close();
  }
});

test("same idempotency key and effective request replays the existing task without another quota charge", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  try {
    const first = await executeDurableTask(runOptions(fixture, executor));
    const retry = await executeDurableTask(runOptions(fixture, executor, {
      idFactory: () => "task_alpha_0002",
      input: makeInput({ goal: "A different display-only goal" }),
    }));

    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    assert.equal(retry.replayed, true);
    assert.equal(retry.task.id, first.task.id);
    assert.equal(retry.task.state, "succeeded");
    assert.equal(executor.calls, 1);
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS total FROM tasks").get().total, 1);
    assert.equal(fixture.sqlite.prepare("SELECT requests_used FROM tenant_request_usage").get().requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("reusing an idempotency key for a different effective request returns HTTP 409", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  try {
    const first = await executeDurableTask(runOptions(fixture, executor));
    const conflict = await executeDurableTask(runOptions(fixture, executor, {
      idFactory: () => "task_alpha_0002",
      input: makeInput({ url: "https://www.iana.org/" }),
    }));
    assert.equal(first.ok, true);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.httpStatus, 409);
    assert.equal(conflict.code, "IDEMPOTENCY_KEY_REUSED");
    assert.equal(executor.calls, 1);
    assert.equal(fixture.sqlite.prepare("SELECT requests_used FROM tenant_request_usage").get().requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("quota exhaustion rolls back the task insert and does not leave an accepted event", async () => {
  const fixture = createDurableTaskD1({ requestLimit: 1 });
  const executor = makeExecutor();
  try {
    const limitedIdentity = { ...identity, requestLimit: 1 };
    const first = await executeDurableTask(runOptions(fixture, executor, { identity: limitedIdentity }));
    const second = await executeDurableTask(runOptions(fixture, executor, {
      identity: limitedIdentity,
      idempotencyKey: "task-retry-key-0002",
      idFactory: () => "task_alpha_0002",
    }));
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.httpStatus, 429);
    assert.equal(second.code, "PLAN_QUOTA_EXCEEDED");
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS total FROM tasks").get().total, 1);
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS total FROM task_events").get().total, 3);
    assert.equal(fixture.sqlite.prepare("SELECT requests_used FROM tenant_request_usage").get().requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("concurrent retries for one idempotency key claim and execute only one task", async () => {
  const fixture = createDurableTaskD1();
  let calls = 0;
  const executeTask = async (_input, options) => {
    calls += 1;
    await Promise.resolve();
    return {
      id: options.idFactory(), state: "succeeded",
      execution: { operation: "fetch" },
      timestamps: { createdAt: FIXED_TIME, startedAt: FIXED_TIME, completedAt: FIXED_TIME },
      usage: { requestsAttempted: 1, responseBytes: 2 },
      events: [], errors: [], result: { status: "succeeded", data: { ok: true }, sources: [], warnings: [] },
    };
  };
  const options = {
    db: fixture.db, identity, input: makeInput(), idempotencyKey: "concurrent-key-0001",
    executeTask, now: () => FIXED_TIME,
  };
  try {
    const [first, second] = await Promise.all([
      executeDurableTask({ ...options, idFactory: () => "task_concurrent_01" }),
      executeDurableTask({ ...options, idFactory: () => "task_concurrent_02" }),
    ]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(first.task.id, second.task.id);
    assert.equal(calls, 1);
    assert.equal(fixture.sqlite.prepare("SELECT requests_used FROM tenant_request_usage").get().requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("task reads are tenant-scoped and expose the same retained lifecycle/result", async () => {
  const fixture = createDurableTaskD1({ tenantIds: ["tenant_alpha", "tenant_beta"] });
  const executor = makeExecutor();
  try {
    const completed = await executeDurableTask(runOptions(fixture, executor));
    const found = await getDurableTask({
      db: fixture.db, tenantId: "tenant_alpha", taskId: completed.task.id, now: () => FIXED_TIME,
    });
    const hidden = await getDurableTask({
      db: fixture.db, tenantId: "tenant_beta", taskId: completed.task.id, now: () => FIXED_TIME,
    });
    assert.equal(found.ok, true);
    assert.equal(found.task.state, "succeeded");
    assert.equal("goal" in found.task, false, "display-only task goals are not retained in D1");
    assert.equal(found.task.result.data.body, "ok");
    assert.deepEqual(found.task.events.map((event) => event.type), ["task.accepted", "task.started", "task.succeeded"]);
    assert.equal(hidden.ok, false);
    assert.equal(hidden.httpStatus, 404);
  } finally {
    fixture.close();
  }
});

test("expired task results become inaccessible and are cleared from D1", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  try {
    const completed = await executeDurableTask(runOptions(fixture, executor));
    const later = "2026-11-25T11:00:01.000Z";
    const expired = await getDurableTask({
      db: fixture.db, tenantId: "tenant_alpha", taskId: completed.task.id, now: () => later,
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.httpStatus, 410);
    const row = fixture.sqlite.prepare("SELECT response_json, result_available FROM tasks WHERE task_id = ?").get(completed.task.id);
    assert.equal(row.response_json, null);
    assert.equal(row.result_available, 0);
  } finally {
    fixture.close();
  }
});

test("oversized results are returned once but not retained beyond the configured D1 row budget", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor({ resultBody: "x".repeat(500) });
  try {
    const completed = await executeDurableTask(runOptions(fixture, executor, { resultMaxBytes: 128 }));
    assert.equal(completed.ok, true);
    assert.equal(completed.task.result.data.body.length, 500);
    assert.equal(completed.task.persistence.resultAvailable, false);
    const readBack = await getDurableTask({
      db: fixture.db, tenantId: "tenant_alpha", taskId: completed.task.id, now: () => FIXED_TIME,
    });
    assert.equal(readBack.ok, true);
    assert.equal(readBack.task.state, "succeeded");
    assert.equal(readBack.task.result, null);
    assert.equal(readBack.task.persistence.resultAvailable, false);
  } finally {
    fixture.close();
  }
});

test("invalid idempotency keys are rejected before D1 acceptance", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  try {
    const invalid = await executeDurableTask(runOptions(fixture, executor, { idempotencyKey: "short" }));
    assert.equal(invalid.ok, false);
    assert.equal(invalid.httpStatus, 400);
    assert.equal(invalid.code, "INVALID_IDEMPOTENCY_KEY");
    assert.equal(fixture.sqlite.prepare("SELECT COUNT(*) AS total FROM tasks").get().total, 0);
  } finally {
    fixture.close();
  }
});


test("REST and MCP request shapes share one canonical idempotency fingerprint", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor();
  const restInput = {
    goal: "REST display goal",
    operation: "search",
    query: "  public web  ",
    source: "wikipedia",
    limit: 5,
    cacheMode: "default",
  };
  const mcpInput = {
    goal: "MCP display goal",
    operation: "search",
    query: "public web",
    source: "wikipedia",
  };
  try {
    const first = await executeDurableTask({
      db: fixture.db, identity, input: restInput, idempotencyKey: "cross-transport-key-01",
      executeTask: executor.executeTask, now: () => FIXED_TIME, idFactory: () => "task_cross_transport_1",
    });
    const retry = await executeDurableTask({
      db: fixture.db, identity, input: mcpInput, idempotencyKey: "cross-transport-key-01",
      executeTask: executor.executeTask, now: () => FIXED_TIME, idFactory: () => "task_cross_transport_2",
    });
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    assert.equal(retry.replayed, true);
    assert.equal(retry.task.id, first.task.id);
    assert.equal(executor.calls, 1);
    assert.equal(fixture.sqlite.prepare("SELECT requests_used FROM tenant_request_usage").get().requests_used, 1);
  } finally {
    fixture.close();
  }
});

test("unsupported adapter outcomes are persisted as valid terminal task states", async () => {
  const fixture = createDurableTaskD1();
  const executor = makeExecutor({ state: "unsupported" });
  try {
    const result = await executeDurableTask(runOptions(fixture, executor));
    assert.equal(result.ok, true);
    assert.equal(result.task.state, "unsupported");
    const stored = fixture.sqlite.prepare("SELECT state FROM tasks WHERE task_id = ?").get(result.task.id);
    assert.equal(stored.state, "unsupported");
    const event = fixture.sqlite.prepare("SELECT event_type FROM task_events WHERE task_id = ? ORDER BY revision DESC LIMIT 1").get(result.task.id);
    assert.equal(event.event_type, "task.unsupported");
  } finally {
    fixture.close();
  }
});

test("the task snapshots the quota policy already active in the current usage window", async () => {
  const fixture = createDurableTaskD1({ requestLimit: 10 });
  const executor = makeExecutor();
  try {
    fixture.sqlite.prepare(
      "INSERT INTO tenant_request_usage (tenant_id, window_id, plan_code, policy_version, request_limit, requests_used, updated_at) " +
      "VALUES ('tenant_alpha', '2026-11-24', 'developer', 'prior-policy-v0', 1, 0, ?)",
    ).run(FIXED_TIME);
    const first = await executeDurableTask(runOptions(fixture, executor));
    assert.equal(first.ok, true);
    assert.equal(first.task.quota.limit, 1);
    assert.equal(first.task.quota.used, 1);
    assert.equal(first.task.quota.remaining, 0);
    const stored = fixture.sqlite.prepare("SELECT quota_limit, policy_version FROM tasks WHERE task_id = ?").get(first.task.id);
    assert.equal(stored.quota_limit, 1);
    assert.equal(stored.policy_version, "prior-policy-v0");
  } finally {
    fixture.close();
  }
});
