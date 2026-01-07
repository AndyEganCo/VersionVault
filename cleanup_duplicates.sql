-- ========================================
-- STEP 1: Create normalize_version function
-- ========================================
CREATE OR REPLACE FUNCTION normalize_version(version_string TEXT, software_name TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
  software_prefix TEXT;
BEGIN
  IF version_string IS NULL OR version_string = '' THEN
    RETURN version_string;
  END IF;

  normalized := TRIM(version_string);

  -- Step 1: Strip software-specific prefixes (e.g., "cobra_v125" → "v125")
  software_prefix := REGEXP_REPLACE(LOWER(software_name), '[^a-z0-9]', '', 'g');

  IF software_prefix != '' THEN
    normalized := REGEXP_REPLACE(
      normalized,
      '^' || software_prefix || '[_\-\s]*(v|version)?[_\-\s]*',
      '',
      'i'
    );
  END IF;

  -- Step 2: Strip common version prefixes
  normalized := REGEXP_REPLACE(
    normalized,
    '^(v|r|version|ver|release)[\s\-_]*(?=\d)',
    '',
    'i'
  );

  -- Step 3: Clean up whitespace
  normalized := TRIM(normalized);

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ========================================
-- STEP 2: Preview duplicates (DRY RUN)
-- ========================================
SELECT
  s.name as software_name,
  normalize_version(svh.version, s.name) as normalized_version,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(svh.version ORDER BY svh.created_at) as original_versions,
  ARRAY_AGG(
    CASE
      WHEN ARRAY_LENGTH(svh.notes, 1) > 0 THEN 'has_notes'
      ELSE 'no_notes'
    END
    ORDER BY svh.created_at
  ) as notes_status
FROM software_version_history svh
JOIN software s ON svh.software_id = s.id
GROUP BY s.name, normalize_version(svh.version, s.name)
HAVING COUNT(*) > 1
ORDER BY s.name, normalized_version;


-- ========================================
-- STEP 3: Merge duplicates
-- ========================================
WITH duplicates AS (
  -- Find all groups of duplicates
  SELECT
    svh.software_id,
    s.name as software_name,
    normalize_version(svh.version, s.name) as normalized_version,
    ARRAY_AGG(svh.id ORDER BY
      -- Prioritize: 1) has notes, 2) has structured_notes, 3) has search_sources, 4) most recent
      (CASE WHEN ARRAY_LENGTH(svh.notes, 1) > 0 THEN 1 ELSE 0 END) DESC,
      (CASE WHEN svh.structured_notes IS NOT NULL THEN 1 ELSE 0 END) DESC,
      (CASE WHEN ARRAY_LENGTH(svh.search_sources, 1) > 0 THEN 1 ELSE 0 END) DESC,
      svh.created_at DESC
    ) as version_ids,
    ARRAY_AGG(svh.version ORDER BY svh.created_at) as original_versions
  FROM software_version_history svh
  JOIN software s ON svh.software_id = s.id
  GROUP BY svh.software_id, s.name, normalize_version(svh.version, s.name)
  HAVING COUNT(*) > 1
),
keepers AS (
  -- Identify the keeper (first in each array) for each duplicate group
  SELECT
    software_id,
    software_name,
    normalized_version,
    version_ids[1] as keeper_id,
    version_ids[2:array_length(version_ids, 1)] as delete_ids,
    original_versions
  FROM duplicates
)
-- Update keepers to use normalized version
UPDATE software_version_history svh
SET version = k.normalized_version
FROM keepers k
WHERE svh.id = k.keeper_id;

-- Delete duplicates (everything except keepers)
WITH duplicates AS (
  SELECT
    svh.software_id,
    s.name as software_name,
    normalize_version(svh.version, s.name) as normalized_version,
    ARRAY_AGG(svh.id ORDER BY
      (CASE WHEN ARRAY_LENGTH(svh.notes, 1) > 0 THEN 1 ELSE 0 END) DESC,
      (CASE WHEN svh.structured_notes IS NOT NULL THEN 1 ELSE 0 END) DESC,
      (CASE WHEN ARRAY_LENGTH(svh.search_sources, 1) > 0 THEN 1 ELSE 0 END) DESC,
      svh.created_at DESC
    ) as version_ids
  FROM software_version_history svh
  JOIN software s ON svh.software_id = s.id
  GROUP BY svh.software_id, s.name, normalize_version(svh.version, s.name)
  HAVING COUNT(*) > 1
),
delete_list AS (
  -- Get all IDs to delete (all except first in each group)
  SELECT unnest(version_ids[2:array_length(version_ids, 1)]) as delete_id
  FROM duplicates
)
DELETE FROM software_version_history
WHERE id IN (SELECT delete_id FROM delete_list);


-- ========================================
-- STEP 4: Verify cleanup
-- ========================================
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ No duplicates remaining!'
    ELSE '⚠ WARNING: ' || COUNT(*) || ' duplicate groups still exist'
  END as result
FROM (
  SELECT
    svh.software_id,
    s.name,
    normalize_version(svh.version, s.name) as normalized_version,
    COUNT(*) as version_count
  FROM software_version_history svh
  JOIN software s ON svh.software_id = s.id
  GROUP BY svh.software_id, s.name, normalize_version(svh.version, s.name)
  HAVING COUNT(*) > 1
) remaining_duplicates;
