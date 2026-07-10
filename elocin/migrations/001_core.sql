-- =============================================================
-- Elocin Core Schema
-- Version: 001
-- Strategy: Industry-agnostic hierarchy
--   Organization → Location → Team → People → Observations
-- Education terminology lives in the APPLICATION LAYER only.
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ORGANIZATIONS
-- Top of the hierarchy. A school district, therapy practice,
-- or any org that owns multiple locations and teams.
-- =============================================================
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,         -- url-safe identifier
  plan          TEXT NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('starter','professional','school','enterprise')),
  settings      JSONB NOT NULL DEFAULT '{}',  -- org-level config, theme, industry
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ                   -- soft delete
);

-- =============================================================
-- LOCATIONS
-- A school building, clinic, office. Optional for small orgs.
-- =============================================================
CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- =============================================================
-- TEAMS
-- Education: classroom. Therapy: caseload. Social work: case group.
-- grade_level is education-specific — stored as freetext string
-- so it's usable across industries ("K", "Grade 1", "Caseload A").
-- =============================================================
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,              -- "Room 4", "Caseload B"
  context_label   TEXT NOT NULL DEFAULT 'Classroom',  -- UI label for this team type
  grade_level     TEXT,                       -- "K", "Grade 1", "Pre-K", null for non-education
  academic_year   TEXT,                       -- "2024-25"
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- =============================================================
-- USERS
-- All humans who log in. Role is per-team (a user can be
-- teacher in one team and TA in another).
-- =============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  avatar_url      TEXT,
  auth_provider   TEXT NOT NULL DEFAULT 'email', -- 'email' | 'google'
  auth_uid        TEXT UNIQUE,                -- external auth ID (Supabase/Auth0)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- =============================================================
-- TEAM MEMBERSHIPS
-- A user's role is scoped to a team, not global.
-- =============================================================
CREATE TABLE team_memberships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL
            CHECK (role IN ('owner','teacher','ta','specialist','admin','parent')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- =============================================================
-- PEOPLE
-- Education: students. Therapy: clients. Social work: cases.
-- No PII beyond name and DOB — keep minimal.
-- =============================================================
CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,              -- first name or alias
  full_name       TEXT,                       -- optional — some orgs don't share full names
  date_of_birth   DATE,
  grade_level     TEXT,                       -- "K", "Pre-K", "1" — drives milestone set
  avatar_url      TEXT,
  notes           TEXT,                       -- internal notes (not shown to parents)
  settings        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                -- soft delete, never hard delete
);

-- =============================================================
-- TEAM ENROLLMENT
-- A person (student) belongs to one or more teams.
-- start_date / end_date track when they joined/left.
-- =============================================================
CREATE TABLE enrollments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date   DATE,                            -- null = currently enrolled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, person_id)
);

-- =============================================================
-- OBSERVATIONS
-- The atomic unit of the entire platform.
-- Everything else is derived from or linked to observations.
--
-- MANDATORY fields (from spec):
--   student_id   → person_id
--   timestamp    → observed_at
--   teacher_id   → recorded_by
--   context      → domain
--   free text    → raw_text
--
-- parsed_json stores the deterministic engine output.
-- It is NEVER re-generated unless raw_text changes.
-- =============================================================
CREATE TABLE observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  recorded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Core content
  raw_text        TEXT NOT NULL,
  domain          TEXT,                       -- 'literacy','maths','behaviour','social','motor','other'
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Recorder context
  recorder_role   TEXT NOT NULL DEFAULT 'teacher'
                  CHECK (recorder_role IN ('teacher','ta','specialist')),

  -- Deterministic engine output — locked on creation, updated only if raw_text changes
  parsed_json     JSONB,                      -- { students, skills, methods, outcome, confidence, flags }
  confidence      TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  confidence_score INT CHECK (confidence_score BETWEEN 0 AND 4),

  -- AI enrichment — only populated when engine confidence = LOW
  ai_enriched     BOOLEAN NOT NULL DEFAULT FALSE,
  ai_enriched_at  TIMESTAMPTZ,
  ai_model        TEXT,                       -- which model was used, for cost tracking

  -- Edit tracking
  edit_count      INT NOT NULL DEFAULT 0,
  last_edited_at  TIMESTAMPTZ,
  last_edited_by  UUID REFERENCES users(id),

  -- Soft delete — observations are NEVER hard deleted (audit requirement)
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES users(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- OBSERVATION AUDIT LOG
-- Append-only. Every edit to an observation creates a row here.
-- Required for FERPA compliance. Never delete from this table.
-- =============================================================
CREATE TABLE observation_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id  UUID NOT NULL REFERENCES observations(id) ON DELETE RESTRICT,
  changed_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_type     TEXT NOT NULL CHECK (change_type IN ('create','edit','delete','restore')),
  previous_text   TEXT,                       -- raw_text before the edit
  new_text        TEXT,                       -- raw_text after the edit
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- GOALS
-- Learning goals, therapy targets, IEP objectives — all the same.
-- Linked to a person, optionally to a team.
-- Evidence (observations) is linked via goal_evidence table.
-- =============================================================
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  title           TEXT NOT NULL,
  description     TEXT,
  domain          TEXT,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date     DATE,

  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','achieved','paused','closed')),
  progress_pct    INT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- =============================================================
-- GOAL EVIDENCE
-- Links observations to goals. An observation can support
-- multiple goals; a goal can have many observations.
-- =============================================================
CREATE TABLE goal_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  linked_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  linked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, observation_id)
);

-- =============================================================
-- INTERVENTIONS
-- Active support strategies for a person.
-- Linked to observations that triggered them.
-- =============================================================
CREATE TABLE interventions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('high','medium','low')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','resolved','paused')),

  started_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_at     DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- REPORTS
-- Generated conference summaries or progress reports.
-- Stored as structured JSON so they can be re-rendered
-- without regeneration unless source data changes.
-- =============================================================
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  generated_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  report_type     TEXT NOT NULL DEFAULT 'conference'
                  CHECK (report_type IN ('conference','progress','summary','parent')),
  period_start    DATE,
  period_end      DATE,

  -- Structured content — deterministic answers to the 4 conference questions
  content_json    JSONB NOT NULL DEFAULT '{}',

  -- AI narrative section — optional, generated on demand
  ai_narrative    TEXT,
  ai_generated_at TIMESTAMPTZ,
  ai_model        TEXT,

  -- Lock flag — when true, report will not auto-update even if data changes
  is_locked       BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PARENT CONTACTS
-- Opt-in only. Linked to a person, not a user account.
-- Teachers share the opt-in link — parent submits name + channel.
-- =============================================================
CREATE TABLE parent_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  optin_token     TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  full_name       TEXT,
  email           TEXT,
  phone           TEXT,
  preferred_channel TEXT CHECK (preferred_channel IN ('email','sms','both')),
  opted_in        BOOLEAN NOT NULL DEFAULT FALSE,
  opted_in_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- INDEXES — query patterns we know we'll hit
-- =============================================================

-- Observations — most common queries
CREATE INDEX idx_obs_person    ON observations(person_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_obs_team      ON observations(team_id)   WHERE is_deleted = FALSE;
CREATE INDEX idx_obs_recorded  ON observations(recorded_by);
CREATE INDEX idx_obs_at        ON observations(observed_at DESC);
CREATE INDEX idx_obs_conf      ON observations(confidence);
CREATE INDEX idx_obs_domain    ON observations(domain);

-- Full-text search on raw observation text
CREATE INDEX idx_obs_fts ON observations USING gin(to_tsvector('english', raw_text));

-- People
CREATE INDEX idx_people_org    ON people(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enroll_team   ON enrollments(team_id);
CREATE INDEX idx_enroll_person ON enrollments(person_id);

-- Team memberships
CREATE INDEX idx_membership_user ON team_memberships(user_id);
CREATE INDEX idx_membership_team ON team_memberships(team_id);

-- Goals
CREATE INDEX idx_goals_person  ON goals(person_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_status  ON goals(status);

-- Audit
CREATE INDEX idx_audit_obs     ON observation_audit(observation_id);
CREATE INDEX idx_audit_changed ON observation_audit(changed_at DESC);

-- =============================================================
-- UPDATED_AT TRIGGER
-- Auto-updates updated_at on every row change.
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated     BEFORE UPDATE ON locations     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teams_updated         BEFORE UPDATE ON teams         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_people_updated        BEFORE UPDATE ON people        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_observations_updated  BEFORE UPDATE ON observations  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_goals_updated         BEFORE UPDATE ON goals         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_interventions_updated BEFORE UPDATE ON interventions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reports_updated       BEFORE UPDATE ON reports       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
