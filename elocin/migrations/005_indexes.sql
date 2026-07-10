-- =============================================================
-- Elocin Missing Indexes
-- Version: 005
-- interventions, reports, parent_contacts, and teams were added/queried
-- by person_id/organization_id across Sessions 6-8 without ever getting
-- matching indexes — 001_core.sql's index section only covered the
-- tables that existed in the original locked file set. Every
-- GET .../people/:personId route on these tables has been a full table
-- scan since it was written.
-- =============================================================

CREATE INDEX idx_interventions_person ON interventions(person_id);
CREATE INDEX idx_interventions_team   ON interventions(team_id);
CREATE INDEX idx_interventions_status ON interventions(status);

CREATE INDEX idx_reports_person ON reports(person_id);
CREATE INDEX idx_reports_team   ON reports(team_id);

CREATE INDEX idx_parent_contacts_person ON parent_contacts(person_id);

CREATE INDEX idx_teams_org ON teams(organization_id) WHERE deleted_at IS NULL;
