-- =============================================================
-- GOAL STATUS HISTORY
-- Append-only log of goal status transitions. Closes the gap where
-- a "progress timeline" has no real event for "goal became active/
-- achieved/paused/closed" — everything else in a timeline (observations,
-- intervention resolution) already has a real timestamp somewhere.
-- One row is inserted at goal creation (from_status NULL, to_status
-- 'active') and one on every subsequent status-changing PATCH.
-- =============================================================
CREATE TABLE goal_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  changed_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_status  TEXT,
  to_status    TEXT NOT NULL CHECK (to_status IN ('active','achieved','paused','closed')),
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_status_history_goal ON goal_status_history(goal_id);

-- =============================================================
-- MILESTONES
-- Definitions (org-scoped, soft-deletable, same pattern as goals) plus
-- per-person status (junction-style, unique per milestone+person).
-- =============================================================
CREATE TABLE milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  domain          TEXT,
  grade_level     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE milestone_status (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id   UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  person_id      UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'not_started'
                 CHECK (status IN ('not_started','in_progress','achieved')),
  achieved_at    DATE,
  updated_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (milestone_id, person_id)
);

CREATE INDEX idx_milestones_org ON milestones(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_milestone_status_person ON milestone_status(person_id);
CREATE INDEX idx_milestone_status_milestone ON milestone_status(milestone_id);

CREATE TRIGGER trg_milestones_updated
  BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_milestone_status_updated
  BEFORE UPDATE ON milestone_status FOR EACH ROW EXECUTE FUNCTION set_updated_at();
