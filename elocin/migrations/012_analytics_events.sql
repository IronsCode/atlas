-- =============================================================
-- Elocin Analytics Events (System 2 — Teacher Value Loop only)
-- Version: 012
-- The ONLY new instrumentation table. Parser accuracy (System 1) and student
-- intelligence (System 3) are derived from domain tables; only elapsed TIME
-- (capture speed, report edit time, retention) needs explicit events.
--
-- Privacy: props NEVER contains raw_text, names, or free text — IDs + enums +
-- numbers only. Student/observation data stays in the domain tables; telemetry
-- stays keys-and-numbers, joinable in-DB for future ML without leaving Postgres.
-- =============================================================
CREATE TABLE analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  event           TEXT NOT NULL,
  observation_id  UUID,                 -- nullable link to the domain object (no FK: events survive deletes)
  report_id       UUID,
  session_id      TEXT,                 -- client-generated; ties a capture funnel together
  duration_ms     INT,                  -- elapsed for *_saved / *_finalized events
  props           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ae_org_time  ON analytics_events(organization_id, created_at);
CREATE INDEX idx_ae_evt_time  ON analytics_events(event, created_at);
CREATE INDEX idx_ae_user_time ON analytics_events(user_id, created_at);
