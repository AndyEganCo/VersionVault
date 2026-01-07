-- Migration: Deprecate software.current_version field
-- Date: 2026-01-07
--
-- IMPORTANT: This migration marks the software.current_version field as deprecated.
-- The field is no longer written to by the application. Instead, current_version is
-- COMPUTED from software_version_history using semantic version comparison.
--
-- The highest semantic version in software_version_history (where newsletter_verified=true)
-- is considered the "current version". This prevents the "version downgrade" bug where
-- scrapers would extract old versions and write them to current_version.
--
-- The field is kept for backward compatibility and reference, but all new code should
-- calculate current_version from software_version_history instead of reading this field.

-- Add comment to the field explaining it's deprecated
COMMENT ON COLUMN software.current_version IS
'DEPRECATED: This field is no longer actively maintained. Current version is computed from software_version_history by taking the highest semantic version where newsletter_verified=true. See src/lib/utils/version-utils.ts (frontend) or supabase/functions/_shared/version-utils.ts (backend) for the calculation logic.';

-- Add comment to release_date as well since it's also deprecated
COMMENT ON COLUMN software.release_date IS
'DEPRECATED: This field is no longer actively maintained. Release date is computed from software_version_history by taking the release_date of the current (highest semantic) version.';

-- Add comments to the software table itself
COMMENT ON TABLE software IS
'Software catalog. Note: current_version and release_date are deprecated fields - these values are now computed from software_version_history using semantic versioning.';

-- For reference: How to calculate current version
--
-- SQL Example (for a single software):
-- SELECT version, release_date
-- FROM software_version_history
-- WHERE software_id = 'YOUR_SOFTWARE_ID'
--   AND newsletter_verified = true
-- ORDER BY version DESC  -- Note: This is simple lexicographic sorting, not true semantic versioning
-- LIMIT 1;
--
-- For true semantic versioning, use the application-level functions:
-- - Frontend: getCurrentVersionFromHistory() in src/lib/utils/version-utils.ts
-- - Backend: getCurrentVersionFromHistory() in supabase/functions/_shared/version-utils.ts
-- - Backend DB query: getCurrentVersionFromDatabase() in supabase/functions/_shared/version-utils.ts
