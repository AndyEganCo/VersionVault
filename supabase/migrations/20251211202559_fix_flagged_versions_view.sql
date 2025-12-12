-- Fix flagged_versions view security definer issue
-- Security Issue: View could bypass RLS policies
-- This migration recreates the view to use SECURITY INVOKER (respects RLS)

-- Drop the existing view
DROP VIEW IF EXISTS flagged_versions;

-- Recreate view with explicit SECURITY INVOKER
-- This ensures the view respects RLS policies of underlying tables
-- and uses the permissions of the querying user, not the view creator
CREATE VIEW flagged_versions
WITH (security_invoker = true)
AS
SELECT
  vh.id,
  vh.software_id,
  s.name AS software_name,
  s.manufacturer,
  vh.version,
  vh.confidence_score,
  vh.validation_notes,
  vh.extraction_method,
  vh.release_date,
  vh.created_at,
  vh.notes
FROM software_version_history vh
JOIN software s ON s.id = vh.software_id
WHERE vh.requires_manual_review = true
ORDER BY vh.created_at DESC;

-- Add helpful comment
COMMENT ON VIEW flagged_versions IS 'View of all versions requiring manual review. Uses SECURITY INVOKER to respect RLS policies of underlying tables.';

-- Verify the view was created with security_invoker
DO $$
DECLARE
  view_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'flagged_versions'
    AND schemaname = 'public'
  ) INTO view_exists;

  IF NOT view_exists THEN
    RAISE EXCEPTION 'flagged_versions view was not created';
  END IF;

  RAISE NOTICE 'flagged_versions view successfully recreated with SECURITY INVOKER';
END $$;
