-- =============================================================
-- Elocin Auth Schema
-- Version: 003
-- Adds password auth + org-level ownership.
--
-- org_role exists because requireOrgRole() has nothing to check
-- against otherwise: a brand-new org has zero team_memberships,
-- so its creator would be locked out of creating their first team.
-- org_role is the org-wide equivalent of a team role, set once at
-- signup for the creating user and otherwise left null.
-- =============================================================

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN org_role TEXT CHECK (org_role IN ('owner', 'admin') OR org_role IS NULL);
