-- =============================================================
-- Elocin Staff Invite Schema
-- Version: 007
-- Adds a teammate-invite flow (previously: signup could only ever
-- create a brand-new org, there was no way to add a second staff
-- user to an existing one). password_hash was already nullable —
-- an invited user has no password until they accept.
--
-- invite_token is the auth for the accept-invite step, same pattern
-- as parent_contacts.optin_token. Cleared once accepted so it can't
-- be reused; "pending" vs "active" is just password_hash IS NULL.
-- =============================================================

ALTER TABLE users ADD COLUMN invite_token TEXT UNIQUE;
ALTER TABLE users ADD COLUMN invited_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN invited_by UUID REFERENCES users(id);

CREATE INDEX idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL;
