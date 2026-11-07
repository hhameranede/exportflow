#!/usr/bin/env python3
"""Run ExportFlow D1 migrations against SQLite and verify key integrity constraints."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")

migrations = sorted((ROOT / "migrations").glob("*.sql"))
if len(migrations) < 2:
    raise SystemExit("Expected the credential-vault and merchant-identity migrations.")

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

print(f"D1 migrations passed ({len(migrations)} files; {len(required)} required tables).")
