-- =============================================================
-- Elocin Student + Classroom fields
-- Version: 014
-- Additive only. Adds structured name/description fields requested for the
-- student profile and classroom edit forms.
--   people.last_name   — surname (display_name stays the first name / roster label)
--   teams.description   — free-text "what this classroom is"
--   teams.subject       — reserved for later UI (no reader yet); added now so no
--                         production migration is needed when the subject field ships
-- =============================================================

ALTER TABLE people ADD COLUMN last_name  TEXT;
ALTER TABLE teams  ADD COLUMN description TEXT;
ALTER TABLE teams  ADD COLUMN subject     TEXT;
