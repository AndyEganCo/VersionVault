-- Migration to normalize disguise Designer versions
-- This removes the 'r' prefix from disguise versions (e.g., "r32.2" -> "32.2")
-- and removes duplicate entries

-- Step 1: Create a temporary table to track versions we want to keep
CREATE TEMP TABLE versions_to_keep AS
SELECT DISTINCT ON (software_id,
  CASE
    WHEN version ~ '^r\d+(\.\d+)*$' THEN regexp_replace(version, '^r', '', 'i')
    ELSE version
  END)
  id,
  software_id,
  version,
  CASE
    WHEN version ~ '^r\d+(\.\d+)*$' THEN regexp_replace(version, '^r', '', 'i')
    ELSE version
  END as normalized_version,
  release_date,
  notes,
  type
FROM software_version_history
WHERE software_id IN (
  SELECT id FROM software
  WHERE name ILIKE '%disguise%' OR name ILIKE '%designer%'
)
ORDER BY software_id,
  CASE
    WHEN version ~ '^r\d+(\.\d+)*$' THEN regexp_replace(version, '^r', '', 'i')
    ELSE version
  END,
  -- Prefer versions without 'r' prefix, then by creation date
  CASE WHEN version ~ '^r\d+(\.\d+)*$' THEN 1 ELSE 0 END,
  created_at DESC;

-- Step 2: Update the versions we're keeping to normalized format
UPDATE software_version_history
SET version = (
  SELECT normalized_version
  FROM versions_to_keep
  WHERE versions_to_keep.id = software_version_history.id
)
WHERE id IN (SELECT id FROM versions_to_keep)
  AND version ~ '^r\d+(\.\d+)*$';

-- Step 3: Delete duplicate versions (those not in our keep list)
DELETE FROM software_version_history
WHERE software_id IN (
  SELECT id FROM software
  WHERE name ILIKE '%disguise%' OR name ILIKE '%designer%'
)
AND id NOT IN (SELECT id FROM versions_to_keep);

-- Step 4: Also normalize the current_version field in the software table
UPDATE software
SET current_version = regexp_replace(current_version, '^r', '', 'i')
WHERE (name ILIKE '%disguise%' OR name ILIKE '%designer%')
  AND current_version ~ '^r\d+(\.\d+)*$';

-- Clean up
DROP TABLE versions_to_keep;
