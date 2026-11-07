#!/usr/bin/env python3
"""Run ExportFlow D1 migrations against SQLite and verify key integrity constraints."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")

migrations = sorted((ROOT / "migrations").glob("*.sql"))
if len(migrations) < 3:
    raise SystemExit("Expected credential-vault, merchant-identity and provider-audit migrations.")

for migration in migrations:
    db.executescript(migration.read_text(encoding="utf-8"))

tables = {
    row[0]
    for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).fetchall()
}
required = {
    "merchant_provider_credentials",
    "merchant_users",
    "merchant_sessions",
    "merchant_security_events",
    "merchant_provider_audit_events",
}
missing = required - tables
assert not missing, f"Missing D1 tables: {sorted(missing)}"

credential_columns = {
    row[1] for row in db.execute(
        "PRAGMA table_info(merchant_provider_credentials)"
    ).fetchall()
}
assert credential_columns == {
    "merchant_id", "provider", "key_id", "iv", "ciphertext",
    "scope", "consented_at", "created_at", "updated_at"
}, "Credential vault must remain ciphertext-only."

db.execute(
    """INSERT INTO merchant_users
       (id, auth_provider, provider_subject, email, email_normalized,
        display_name, email_verified_at, created_at, updated_at,
        last_login_at, disabled_at)
       VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, NULL)""",
    ("merchant-test-1", "google-subject-test", "merchant@example.test",
     "merchant@example.test", "Test Merchant", "2026-11-07T12:00:00Z",
     "2026-11-07T12:00:00Z", "2026-11-07T12:00:00Z",
     "2026-11-07T12:00:00Z")
)
db.execute(
    """INSERT INTO merchant_sessions
       (id, merchant_user_id, token_hash, created_at, expires_at,
        last_seen_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)""",
    ("session-test-1", "merchant-test-1", "a" * 64,
     "2026-11-07T12:00:00Z", "2026-11-14T12:00:00Z",
     "2026-11-07T12:00:00Z")
)
db.execute(
    """INSERT INTO merchant_security_events
       (id, merchant_user_id, event_type, created_at, metadata_json)
       VALUES (?, ?, ?, ?, ?)""",
    ("event-test-1", "merchant-test-1", "merchant.session.created",
     "2026-11-07T12:00:00Z", '{"provider":"google"}')
)

for statement in (
    "UPDATE merchant_security_events SET metadata_json = '{}' WHERE id = 'event-test-1'",
    "DELETE FROM merchant_security_events WHERE id = 'event-test-1'",
):
    try:
        db.execute(statement)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Merchant security events must be append-only.")

try:
    db.execute(
        """INSERT INTO merchant_sessions
           (id, merchant_user_id, token_hash, created_at, expires_at,
            last_seen_at, revoked_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)""",
        ("session-invalid-user", "missing-user", "b" * 64,
         "2026-11-07T12:00:00Z", "2026-11-14T12:00:00Z",
         "2026-11-07T12:00:00Z")
    )
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Merchant sessions must reference an existing merchant.")


# A credential write emits metadata-only lifecycle events automatically.
credential_row = (
    "merchant-test-1", "yalidine", "test-key-v1", "a" * 16,
    "ciphertext-only-test-value", "track", "2026-11-07T12:01:00Z",
    "2026-11-07T12:01:00Z", "2026-11-07T12:01:00Z"
)
db.execute(
    """INSERT INTO merchant_provider_credentials
       (merchant_id, provider, key_id, iv, ciphertext, scope, consented_at,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    credential_row
)
audit_rows = db.execute(
    "SELECT event_type, provider, metadata_json FROM merchant_provider_audit_events ORDER BY occurred_at"
).fetchall()
assert audit_rows == [("credential.connected", "yalidine", '{"scope":"track"}')], audit_rows

# Updating an existing connection and disconnecting it each produce one event.
db.execute(
    """UPDATE merchant_provider_credentials
       SET key_id = ?, iv = ?, ciphertext = ?, updated_at = ?
       WHERE merchant_id = ? AND provider = ?""",
    ("test-key-v2", "b" * 16, "replacement-ciphertext", "2026-11-07T12:02:00Z",
     "merchant-test-1", "yalidine")
)
db.execute(
    "DELETE FROM merchant_provider_credentials WHERE merchant_id = ? AND provider = ?",
    ("merchant-test-1", "yalidine")
)
audit_rows = db.execute(
    "SELECT event_type, provider, metadata_json FROM merchant_provider_audit_events ORDER BY occurred_at"
).fetchall()
assert audit_rows == [
    ("credential.connected", "yalidine", '{"scope":"track"}'),
    ("credential.updated", "yalidine", '{"scope":"track"}'),
    ("credential.disconnected", "yalidine", '{"scope":"track"}')
], audit_rows
assert "ciphertext-only-test-value" not in str(audit_rows)
assert "apiToken" not in str(audit_rows)

for statement in (
    "UPDATE merchant_provider_audit_events SET metadata_json = '{}' WHERE event_type = 'credential.connected'",
    "DELETE FROM merchant_provider_audit_events WHERE event_type = 'credential.connected'",
):
    try:
        db.execute(statement)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Merchant provider audit events must be append-only.")

print(f"D1 migrations passed ({len(migrations)} files; {len(required)} required tables).")
