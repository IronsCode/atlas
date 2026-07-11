-- =============================================================
-- Elocin — Email-verified signup
-- Version: 017
-- Strategy: ADDITIVE (new table only; no existing table touched).
--
-- Public self-signups are STAGED here until the email is verified AND a
-- password is set. Only then does POST /auth/verify-signup/:token/complete
-- create the real organization + owner user. This keeps the users table free
-- of unverified/orphan rows and makes signup enumeration-safe.
-- =============================================================

CREATE TABLE IF NOT EXISTS pending_signups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name          TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  token_hash        TEXT NOT NULL UNIQUE,        -- SHA-256 of the emailed token
  email_verified_at TIMESTAMPTZ,                 -- set when the link is opened
  expires_at        TIMESTAMPTZ NOT NULL,        -- link validity (24h)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active pending signup per email (a re-signup replaces the prior row).
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups (lower(email));
