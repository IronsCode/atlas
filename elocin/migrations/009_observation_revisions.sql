-- =============================================================
-- Elocin Evidence Immutability
-- Version: 009
-- Stops the first data-loss path: PATCH /observations used to overwrite
-- raw_text in place, destroying the teacher's original language.
--
-- New model:
--   observations.raw_text      = the IMMUTABLE original (enforced by trigger)
--   observations.current_text  = latest edited text; NULL means "never edited"
--   observation_revisions      = append-only history of every correction
--
-- Observation identity (id) is UNCHANGED, so every existing FK from
-- goals/goal_evidence/reports/interventions keeps working. No new observation
-- rows are spawned on edit.
-- =============================================================

CREATE TABLE observation_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id  UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  edited_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_obs_rev_observation ON observation_revisions(observation_id);
CREATE INDEX idx_obs_rev_org         ON observation_revisions(organization_id);

-- current_text: the latest edited note text. NULL = unchanged (= raw_text).
ALTER TABLE observations ADD COLUMN current_text TEXT;

-- -------------------------------------------------------------
-- Guard 1: raw_text is immutable at the DB level. Any UPDATE that changes it
-- is rejected regardless of application-layer bugs. current_text / edit_count
-- / confidence / etc. remain freely updatable.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_raw_text_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_text IS DISTINCT FROM OLD.raw_text THEN
    RAISE EXCEPTION 'observations.raw_text is immutable; append to observation_revisions instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obs_raw_immutable
  BEFORE UPDATE ON observations
  FOR EACH ROW EXECUTE FUNCTION forbid_raw_text_update();

-- -------------------------------------------------------------
-- Guard 2: observation_revisions is append-only — no UPDATE (history is never
-- rewritten). DELETE is intentionally NOT blocked: the only legitimate delete
-- is a CASCADE from a hard-deleted parent observation (data-subject erasure /
-- org offboarding), which must remain possible. An in-place UPDATE is the real
-- overwrite threat and is what we forbid.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: %.% rows cannot be updated', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obs_rev_append_only
  BEFORE UPDATE ON observation_revisions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
