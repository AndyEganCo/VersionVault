-- Migration: Remove deprecated current_version and release_date columns
-- Date: 2026-01-07
--
-- These fields are no longer used. Current version is now computed from
-- software_version_history using semantic versioning + manual overrides.

-- Remove deprecated columns
ALTER TABLE software
DROP COLUMN IF EXISTS current_version,
DROP COLUMN IF EXISTS release_date;

-- Update table comment
COMMENT ON TABLE software IS
'Software catalog. Current version and release date are computed from software_version_history. Use getCurrentVersionFromHistory() from version-utils to get the current version.';
