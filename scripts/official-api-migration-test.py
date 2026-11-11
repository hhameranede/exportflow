#!/usr/bin/env python3
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
migrations = root / "migrations"
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys = ON")

for name in [
    "0001_merchant_credentials.sql",
    "0002_merchant_identity.sql",
    "0003_merchant_provider_audit.sql",
]:
    db.executescript((migrations / name).read_text(encoding="utf-8"))

db.execute(
    "INSERT INTO merchant_users "
    "(id,auth_provider,provider_subject,email,email_normalized,display_name,email_verified_at,created_at,updated_at,last_login_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?)",
    ("merchant-test", "google", "google-subject", "merchant@example.test",
     "merchant@example.test", "Test Merchant", "2026-11-11T00:00:00Z",
     "2026-11-11T00:00:00Z", "2026-11-11T00:00:00Z", "2026-11-11T00:00:00Z")
)
db.execute(
    "INSERT INTO merchant_provider_credentials "
    "(merchant_id,provider,key_id,iv,ciphertext,scope,consented_at,created_at,updated_at) "
    "VALUES (?,?,?,?,?,?,?,?,?)",
    ("merchant-test", "yalidine", "key-1", "iv", "ciphertext", "track",
     "2026-11-11T00:00:00Z", "2026-11-11T00:00:00Z", "2026-11-11T00:00:00Z")
)
before = db.execute("SELECT COUNT(*) FROM merchant_provider_audit_events").fetchone()[0]
assert before == 1, "Legacy credential trigger must record a metadata-only event"

db.executescript((migrations / "0008_merchant_official_api_credentials.sql").read_text(encoding="utf-8"))

after = db.execute("SELECT COUNT(*) FROM merchant_provider_audit_events").fetchone()[0]
assert after == before, "Migration 0008 must preserve all existing audit rows"

db.execute(
    "INSERT INTO merchant_official_api_credentials "
    "(merchant_id,provider,key_id,iv,ciphertext,scope,consented_at,created_at,updated_at) "
    "VALUES (?,?,?,?,?,?,?,?,?)",
    ("merchant-test", "ups", "key-1", "random-iv", "encrypted-ciphertext",
     "sandbox_track", "2026-11-11T00:01:00Z", "2026-11-11T00:01:00Z", "2026-11-11T00:01:00Z")
)
row = db.execute(
    "SELECT provider,event_type,metadata_json FROM merchant_provider_audit_events ORDER BY occurred_at DESC LIMIT 1"
).fetchone()
assert row == ("ups", "credential.connected", '{"scope":"sandbox_track"}'), "Official credential audit must contain scope only"
assert "encrypted-ciphertext" not in row[2], "Audit metadata must never contain credential material"

columns = {row[1] for row in db.execute("PRAGMA table_info(merchant_official_api_credentials)")}
assert {"merchant_id", "provider", "key_id", "iv", "ciphertext", "scope"} <= columns
assert not ({"api_key", "api_secret", "client_secret", "client_id"} & columns), "No plaintext credential columns may exist"

try:
    db.execute("UPDATE merchant_provider_audit_events SET metadata_json='{}'")
    raise AssertionError("Audit log must reject updates")
except sqlite3.IntegrityError:
    pass

try:
    db.execute("DELETE FROM merchant_provider_audit_events")
    raise AssertionError("Audit log must reject deletion")
except sqlite3.IntegrityError:
    pass

assert db.execute("PRAGMA foreign_key_check").fetchall() == []
print("Official API migrations passed: legacy audit preserved, UPS/FedEx scope recorded, secrets remain encrypted-only.")
