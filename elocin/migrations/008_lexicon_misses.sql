-- =============================================================
-- Elocin Lexicon Misses
-- Version: 008
-- Advisory, append-only log of notes the deterministic lexicon could not
-- confidently tag (LOW confidence) or where a teacher manually added a tag,
-- so future lexicon versions can be batch-reviewed (versioned releases, not
-- continuous edits). Written best-effort at the API layer — never gates a
-- save. The engine itself never writes here (core/ stays pure).
-- =============================================================
CREATE TABLE lexicon_misses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  observation_id   UUID REFERENCES observations(id) ON DELETE SET NULL,
  raw_text         TEXT NOT NULL,
  lexicon_version  TEXT,
  suggestions      JSONB NOT NULL DEFAULT '{}',   -- MEDIUM/fuzzy matches the engine offered
  reason           TEXT CHECK (reason IN ('low_confidence','manual_tag')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lexicon_misses_org ON lexicon_misses(organization_id);
CREATE INDEX idx_lexicon_misses_created ON lexicon_misses(created_at);
