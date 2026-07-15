-- =============================================================
-- Elocin — External AI Governance
-- Version: 018 (additive)
-- (1) Per-organization consent for external AI processing. Default FALSE:
--     privacy by default. No org's data leaves the tenant boundary for external
--     AI unless an owner explicitly opts in. Enforced by callers when selecting
--     records (lib/externalAI.js records the decision).
-- (2) A PII-free audit trail of every external AI attempt. The raw prompt is
--     NEVER stored here — only the decision, versions, and token counts.
-- =============================================================

ALTER TABLE organizations
  ADD COLUMN external_processing_allowed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE ai_request_audit (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature                  TEXT NOT NULL,                 -- e.g. 'lexicon_proposer'
  provider                 TEXT NOT NULL,                 -- e.g. 'anthropic'
  model                    TEXT,                          -- e.g. 'claude-haiku-4-5'
  organization_id          UUID REFERENCES organizations(id) ON DELETE SET NULL, -- NULL for cross-org batches
  knowledge_version        TEXT,                          -- lexicon/semantic version in effect
  deidentify_version       TEXT,                          -- lib/deidentify.js version
  prompt_template_version  TEXT,                          -- the calling feature's template version
  decision                 TEXT NOT NULL,                 -- sent | blocked_global_disabled | blocked_no_key
                                                          --  | blocked_residual_pii | provider_error | transport_error
  input_tokens             INTEGER NOT NULL DEFAULT 0,
  output_tokens            INTEGER NOT NULL DEFAULT 0,
  records_processed        INTEGER NOT NULL DEFAULT 0,     -- records included after consent + de-id
  records_dropped          INTEGER NOT NULL DEFAULT 0,     -- records dropped for residual PII
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_request_audit_created ON ai_request_audit(created_at);
CREATE INDEX idx_ai_request_audit_feature ON ai_request_audit(feature);
