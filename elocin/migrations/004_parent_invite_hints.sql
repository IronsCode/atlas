-- =============================================================
-- Elocin Parent Invite Hints
-- Version: 004
-- Lets staff record where they intend to send an opt-in invite, so
-- automated delivery (Twilio/SendGrid) has a destination before the
-- parent has submitted anything themselves. Separate from
-- email/phone, which are the parent's own submitted, opted-in values.
-- =============================================================

ALTER TABLE parent_contacts ADD COLUMN invited_email TEXT;
ALTER TABLE parent_contacts ADD COLUMN invited_phone TEXT;
ALTER TABLE parent_contacts ADD COLUMN invite_sent_at TIMESTAMPTZ;
