-- DRY RUN: Check for duplicate versions BEFORE running the migration
-- Run this first to see what would be affected by the cleanup

-- Create temporary version of normalize function (won't persist)
CREATE OR REPLACE FUNCTION normalize_version_temp(version_string TEXT, software_name TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
  software_prefix TEXT;
BEGIN
  IF version_string IS NULL OR version_string = '' THEN
    RETURN version_string;
  END IF;

  normalized := TRIM(version_string);

  -- Strip software-specific prefixes (e.g., "cobra_v125" → "v125")
  software_prefix := REGEXP_REPLACE(LOWER(software_name), '[^a-z0-9]', '', 'g');

  IF software_prefix != '' THEN
    normalized := REGEXP_REPLACE(
      normalized,
      '^' || software_prefix || '[_\-\s]*(v|version)?[_\-\s]*',
      '',
      'i'
    );
  END IF;

  -- Strip common version prefixes
  normalized := REGEXP_REPLACE(
    normalized,
    '^(v|r|version|ver|release)[\s\-_]*(?=\d)',
    '',
    'i'
  );

  -- Clean up whitespace
  normalized := TRIM(normalized);

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Show all duplicate groups
SELECT
  s.name as software_name,
  normalize_version_temp(svh.version, s.name) as normalized_version,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(svh.version ORDER BY svh.created_at) as original_versions,
  ARRAY_AGG(svh.id ORDER BY svh.created_at) as version_ids,
  ARRAY_AGG(
    CASE
      WHEN ARRAY_LENGTH(svh.notes, 1) > 0 THEN 'has_notes'
      ELSE 'no_notes'
    END
    ORDER BY svh.created_at
  ) as notes_status,
  ARRAY_AGG(svh.created_at ORDER BY svh.created_at) as created_dates
FROM software_version_history svh
JOIN software s ON svh.software_id = s.id
GROUP BY s.name, normalize_version_temp(svh.version, s.name)
HAVING COUNT(*) > 1
ORDER BY s.name, normalized_version;

-- Summary count
SELECT
  COUNT(*) as total_duplicate_groups,
  SUM(duplicate_count - 1) as total_entries_to_remove
FROM (
  SELECT
    s.name,
    normalize_version_temp(svh.version, s.name) as normalized_version,
    COUNT(*) as duplicate_count
  FROM software_version_history svh
  JOIN software s ON svh.software_id = s.id
  GROUP BY s.name, normalize_version_temp(svh.version, s.name)
  HAVING COUNT(*) > 1
) summary;

-- Clean up temp function
DROP FUNCTION normalize_version_temp(TEXT, TEXT);
