-- =============================================================
-- Elocin Interpretations
-- Version: 010
-- Stops the second data-loss path: applyConfirmedTags used to merge a
-- teacher's confirmations into parsed_json and overwrite it, destroying the
-- rule engine's original output (the training signal for parser improvement).
--
-- New model: evidence (observation) vs opinion (interpretation) are separate.
-- One row per parse event, NEVER overwritten. rules / ai / teacher outputs
-- coexist. Exactly one is_current per observation (precedence teacher > ai >
-- rules, resolved by the writer flipping the previous current row).
--
-- observations.parsed_json is demoted to a denormalized CACHE of the current
-- interpretation payload, so existing consumers keep working untouched.
-- =============================================================

CREATE TABLE interpretations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id        UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source                TEXT NOT NULL CHECK (source IN ('rules','ai','teacher')),
  lexicon_version       TEXT,                       -- null for teacher/ai
  confidence            TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  confidence_score      INT  CHECK (confidence_score BETWEEN 0 AND 4),
  score_formula_version TEXT,                       -- 'signal-v2' now; 'legacy' for backfilled rows
  payload               JSONB NOT NULL,             -- { skills, method, grouping, support, methods(legacy), outcome, perSkillOutcome, ... }
  is_current            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by            UUID REFERENCES users(id),  -- null for rules/ai
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interp_observation ON interpretations(observation_id);
CREATE INDEX idx_interp_org         ON interpretations(organization_id);
CREATE INDEX idx_interp_current     ON interpretations(observation_id) WHERE is_current;
-- At most one current interpretation per observation, enforced by the DB.
CREATE UNIQUE INDEX uq_interp_one_current ON interpretations(observation_id) WHERE is_current;

-- -------------------------------------------------------------
-- Append-only: content (payload/source/etc.) is frozen; only the is_current
-- flag may flip. DELETE is intentionally NOT blocked — the only legitimate
-- delete is a CASCADE from a hard-deleted parent observation (erasure). The
-- overwrite threat we must stop is an in-place content UPDATE.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION interpretations_guard() RETURNS TRIGGER AS $$
BEGIN
  IF ROW(NEW.payload, NEW.source, NEW.observation_id, NEW.lexicon_version, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.payload, OLD.source, OLD.observation_id, OLD.lexicon_version, OLD.created_at) THEN
    RAISE EXCEPTION 'interpretations are immutable except the is_current flag';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_interp_guard
  BEFORE UPDATE ON interpretations
  FOR EACH ROW EXECUTE FUNCTION interpretations_guard();
