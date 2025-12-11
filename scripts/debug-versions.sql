-- Debug script to check for duplicate or invalid versions
-- Run this in Supabase SQL Editor

-- Check for duplicate version numbers for TouchDesigner
SELECT
  version,
  COUNT(*) as count,
  array_agg(id) as ids
FROM software_version_history
WHERE software_id IN (
  SELECT id FROM software WHERE name ILIKE '%TouchDesigner%'
)
GROUP BY version
HAVING COUNT(*) > 1;

-- Check for null or empty versions
SELECT
  id,
  software_id,
  version,
  release_date,
  type,
  length(version) as version_length
FROM software_version_history
WHERE software_id IN (
  SELECT id FROM software WHERE name ILIKE '%TouchDesigner%'
)
AND (version IS NULL OR version = '' OR trim(version) = '');

-- Check all TouchDesigner versions
SELECT
  s.name,
  vh.id,
  vh.version,
  vh.release_date,
  vh.type,
  vh.notes
FROM software_version_history vh
JOIN software s ON s.id = vh.software_id
WHERE s.name ILIKE '%TouchDesigner%'
ORDER BY vh.version;
