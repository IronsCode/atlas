-- =============================================================
-- Elocin auth hardening — password reset + session invalidation
-- Version: 016  (additive)
--
-- password_reset_token_hash : SHA-256 of a random token (raw token is emailed,
--                             never stored). Single-use: cleared on reset.
-- password_reset_expires_at : 1-hour expiry; expired tokens are rejected.
-- password_changed_at       : set on every password change/reset. Nullable —
--                             NULL means "never changed since account creation",
--                             so freshly-issued tokens are never self-invalidated.
--                             verifyToken() rejects any JWT whose iat predates it,
--                             so a reset/change invalidates all previously-issued
--                             JWTs (stateless-session logout).
-- =============================================================
ALTER TABLE users ADD COLUMN password_reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN password_changed_at       TIMESTAMPTZ;

CREATE INDEX idx_users_reset_token ON users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;
