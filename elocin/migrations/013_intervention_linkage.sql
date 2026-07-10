-- =============================================================
-- Elocin Intervention Linkage (System 3 — Student Intelligence foundation)
-- Version: 013
-- Captures the one thing that is cheap now and IMPOSSIBLE to reconstruct
-- later: what an intervention targeted, and which observations came after it.
-- Intervention effectiveness ("did skill S improve after intervention I
-- started") is unrecoverable if we never record the target + the evidence.
--
-- No recommendation engine is built here — only the data foundation.
-- This schema must exist BEFORE interventions are created in volume.
-- =============================================================

ALTER TABLE interventions ADD COLUMN goal_id      UUID REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE interventions ADD COLUMN target_skill TEXT;  -- lexicon skill key, for interventions without a formal goal

-- Mirrors goal_evidence: which observations evidence an intervention's effect.
CREATE TABLE intervention_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  observation_id  UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  linked_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (intervention_id, observation_id)
);

CREATE INDEX idx_iv_evidence_intervention ON intervention_evidence(intervention_id);
CREATE INDEX idx_iv_evidence_observation  ON intervention_evidence(observation_id);
