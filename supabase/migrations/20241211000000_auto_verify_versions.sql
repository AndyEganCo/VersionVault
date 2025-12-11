-- Auto-verify all existing unverified versions
-- This fixes the issue where versions were showing in dashboard but not in digest emails

-- Update all unverified versions to be verified
UPDATE software_version_history
SET
  newsletter_verified = true,
  verified_at = COALESCE(verified_at, NOW())
WHERE newsletter_verified = false;

-- Add a comment explaining the change
COMMENT ON COLUMN software_version_history.newsletter_verified IS
  'Whether this version has been verified for inclusion in newsletter digests. New versions are now auto-verified by default.';
