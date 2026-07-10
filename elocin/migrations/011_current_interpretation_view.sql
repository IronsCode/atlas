-- =============================================================
-- Elocin Current-Interpretation Compatibility View
-- Version: 011
-- Forward path for consumers to read the winning interpretation without
-- knowing about precedence/append-only mechanics. Lets us migrate the ~7
-- parsed_json readers gradually instead of in one big-bang rewrite.
-- =============================================================
CREATE VIEW v_current_interpretation AS
  SELECT observation_id,
         organization_id,
         source,
         lexicon_version,
         confidence,
         confidence_score,
         score_formula_version,
         payload,
         created_at
  FROM interpretations
  WHERE is_current;
