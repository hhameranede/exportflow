import assert from "node:assert/strict";
import test from "node:test";
import {
  createTenantOAuthAccessTokenClaims,
  getActiveTenantMembership,
  getSelectedOAuthTenant,
  listActiveTenantMemberships,
  resolveOAuthTenantPrincipal,
  storeOAuthTenantSelection,
} from "../src/core/tenant-membership.js";

const rowsV8 = [
  { membership_id: "mem_1", membership_version: 1, user_id: "user_1", tenant_id: "tenant_1", role: "owner", plan_code: "starter", quota_period: "daily", request_limit: 25, policy_version: "v1", status: "active", tenant_status: "active", plan_status: "active" },
  { membership_id: "mem_2", membership_version: 1, user_id: "user_1", tenant_id: "tenant_2", role: "member", plan_code: "starter", quota_period: "daily", request_limit: 25, policy_version: "v1", status: "active", tenant_status: "active", plan_status: "active" },
  { membership_id: "mem_3", membership_version: 1, user_id: "user_1", tenant_id: "tenant_3", role: "member", plan_code: "starter", quota_period: "daily", request_limit: 25, policy_version: "v1", status: "revoked", tenant_status: "active", plan_status: "active" },
];

function makeMembershipDbV8() {
  const selections = new Map();
  return {
    selections,
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async all() {
          if (!sql.includes("FROM tenant_memberships AS m")) throw new Error("Unexpected SQL.");
          return { results: rowsV8.filter(row =>
            row.user_id === params[0] && row.status === "active" &&
            row.tenant_status === "active" && row.plan_status === "active"
          ).map(({ membership_id, user_id, tenant_id, role, membership_version, plan_code, quota_period, request_limit, policy_version }) =>
            ({ membership_id, user_id, tenant_id, role, membership_version, plan_code, quota_period, request_limit, policy_version })
          ) };
        },
        async first() {
          if (sql.includes("FROM tenant_oauth_selections")) {
            const row = selections.get(params[0]);
            return row && row.user_id === params[1] && row.expires_at > params[2] ? { tenant_id: row.tenant_id } : null;
          }
          if (sql.includes("FROM tenant_memberships AS m")) {
            const row = rowsV8.find(item => item.user_id === params[0] && item.tenant_id === params[1] &&
              item.status === "active" && item.tenant_status === "active" && item.plan_status === "active");
            if (!row) return null;
            const { membership_id, user_id, tenant_id, role, membership_version, plan_code, quota_period, request_limit, policy_version } = row;
            return { membership_id, user_id, tenant_id, role, membership_version, plan_code, quota_period, request_limit, policy_version };
          }
          throw new Error("Unexpected query.");
        },
        async run() {
          if (!sql.includes("INSERT INTO tenant_oauth_selections")) throw new Error("Unexpected write.");
          selections.set(params[0], { session_id: params[0], user_id: params[1], tenant_id: params[2], selected_at: params[3], expires_at: params[4] });
          return { success: true };
        },
      };
    },
  };
}

test("active membership lookup excludes revoked memberships", async () => {
  const db = makeMembershipDbV8();
  const all = await listActiveTenantMemberships(db, "user_1");
  assert.deepEqual(all.map(item => item.tenantId), ["tenant_1", "tenant_2"]);
  assert.equal(await getActiveTenantMembership(db, "user_1", "tenant_3"), null);
});

test("tenant selection persists only for an active membership and expires within ten minutes", async () => {
  const db = makeMembershipDbV8();
  const selected = await storeOAuthTenantSelection(db, {
    sessionId: "session_1", userId: "user_1", tenantId: "tenant_2",
    now: () => "2026-11-21T10:00:00.000Z",
    sessionExpiresAt: "2026-11-21T11:00:00.000Z",
  });
  assert.equal(selected.tenantId, "tenant_2");
  assert.equal(selected.expiresAt, "2026-11-21T10:10:00.000Z");
  assert.equal(await storeOAuthTenantSelection(db, {
    sessionId: "session_1", userId: "user_1", tenantId: "tenant_3",
    now: () => "2026-11-21T10:00:00.000Z",
    sessionExpiresAt: "2026-11-21T11:00:00.000Z",
  }), null);
});

test("saved selection is revalidated after membership revocation and expiry", async () => {
  const db = makeMembershipDbV8();
  await storeOAuthTenantSelection(db, {
    sessionId: "session_1", userId: "user_1", tenantId: "tenant_1",
    now: () => "2026-11-21T10:00:00.000Z",
    sessionExpiresAt: "2026-11-21T10:05:00.000Z",
  });
  assert.equal((await getSelectedOAuthTenant(db, {
    sessionId: "session_1", userId: "user_1", now: () => "2026-11-21T10:01:00.000Z"
  })).tenantId, "tenant_1");
  assert.equal(await getSelectedOAuthTenant(db, {
    sessionId: "session_1", userId: "user_1", now: () => "2026-11-21T10:06:00.000Z"
  }), null);
  rowsV8[0].status = "revoked";
  assert.equal(await getSelectedOAuthTenant(db, {
    sessionId: "session_1", userId: "user_1", now: () => "2026-11-21T10:02:00.000Z"
  }), null);
  rowsV8[0].status = "active";
});

test("OAuth access-token claims require active membership and preserve its role", async () => {
  const db = makeMembershipDbV8();
  const claims = await createTenantOAuthAccessTokenClaims(db, {
    user: { id: "user_1" }, referenceId: "tenant_2"
  });
  assert.deepEqual(claims, {
    "https://exportflow.me/claims/tenant": {
      id: "tenant_2", role: "member", membership_id: "mem_2", membership_version: 1
    }
  });
  await assert.rejects(
    createTenantOAuthAccessTokenClaims(db, {
      user: { id: "user_1" }, referenceId: "tenant_3"
    }),
    /active tenant membership and plan are required/i
  );
});

test("OAuth tenant principal is resolved from current D1 membership and scope claims", async () => {
  const db = makeMembershipDbV8();
  const principal = await resolveOAuthTenantPrincipal(db, {
    sub: "user_1",
    scope: "openid tasks:fetch tasks:map",
    "https://exportflow.me/claims/tenant": {
      id: "tenant_2", membership_id: "mem_2", membership_version: 1
    }
  });
  assert.equal(principal.tenantId, "tenant_2");
  assert.equal(principal.userId, "user_1");
  assert.equal(principal.authMethod, "oauth2");
  assert.deepEqual(principal.scopes, ["openid", "tasks:fetch", "tasks:map"]);
});

test("OAuth tokens issued before membership changes are rejected", async () => {
  const db = makeMembershipDbV8();
  rowsV8[1].membership_version = 2;
  await assert.rejects(
    resolveOAuthTenantPrincipal(db, {
      sub: "user_1",
      scope: "tasks:fetch",
      "https://exportflow.me/claims/tenant": {
        id: "tenant_2", membership_id: "mem_2", membership_version: 1
      }
    }),
    (error) => error.code === "TENANT_MEMBERSHIP_CHANGED"
  );
  rowsV8[1].membership_version = 1;
});

test("OAuth tokens are rejected when D1 no longer has an active membership", async () => {
  const db = makeMembershipDbV8();
  rowsV8[1].status = "revoked";
  await assert.rejects(
    resolveOAuthTenantPrincipal(db, {
      sub: "user_1",
      scope: "tasks:fetch",
      "https://exportflow.me/claims/tenant": {
        id: "tenant_2", membership_id: "mem_2", membership_version: 1
      }
    }),
    (error) => error.code === "TENANT_MEMBERSHIP_INACTIVE"
  );
  rowsV8[1].status = "active";
});
