-- Version Verification for Newsletter
-- New versions must be verified before they're included in digests

-- Add verification column to software_version_history
ALTER TABLE software_version_history
  ADD COLUMN IF NOT EXISTS newsletter_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Index for finding unverified versions
CREATE INDEX IF NOT EXISTS idx_software_version_history_unverified
  ON software_version_history(newsletter_verified, detected_at DESC)
  WHERE newsletter_verified = false;

-- Allow admins to update verification status
DROP POLICY IF EXISTS "Admins can update version verification" ON software_version_history;
CREATE POLICY "Admins can update version verification" ON software_version_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
