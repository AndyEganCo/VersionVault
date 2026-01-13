-- Migration: Normalize and merge duplicate version entries
-- This cleans up existing duplicates like "r32" and "32", "cobra_v125" and "v125"

-- Step 1: Create a PostgreSQL function to normalize version strings
-- This mirrors the normalizeVersion() function in TypeScript
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
    -- Match: softwarename_v, softwarename-v, softwarename_version, etc.
    normalized := REGEXP_REPLACE(
      normalized,
      '^' || software_prefix || '[_\-\s]*(v|version)?[_\-\s]*',
      '',
      'i'
    );
  END IF;

  -- Step 2: Strip common version prefixes
  -- Match: "v", "r", "version ", "ver ", "release " followed by a digit
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

-- Step 2: DRY RUN - Show what duplicates exist
-- Run this first to see what would be affected
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Count how many duplicate groups exist
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      svh.software_id,
      s.name,
      normalize_version(svh.version, s.name) as normalized_version,
      COUNT(*) as version_count,
      ARRAY_AGG(svh.version ORDER BY svh.created_at) as original_versions,
      ARRAY_AGG(svh.id ORDER BY svh.created_at) as version_ids
    FROM software_version_history svh
    JOIN software s ON svh.software_id = s.id
    GROUP BY svh.software_id, s.name, normalize_version(svh.version, s.name)
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'DRY RUN: Found % groups of duplicate versions', duplicate_count;
  RAISE NOTICE '============================================';

  -- Show details of duplicates
  FOR duplicate_row IN
    SELECT
      s.name as software_name,
      normalize_version(svh.version, s.name) as normalized_version,
      COUNT(*) as version_count,
      ARRAY_AGG(svh.version ORDER BY svh.created_at) as original_versions,
      ARRAY_AGG(svh.created_at ORDER BY svh.created_at) as created_dates
    FROM software_version_history svh
    JOIN software s ON svh.software_id = s.id
    GROUP BY s.name, normalize_version(svh.version, s.name)
    HAVING COUNT(*) > 1
    ORDER BY s.name, normalized_version
  LOOP
    RAISE NOTICE 'Software: % | Normalized: % | Count: % | Originals: %',
      duplicate_row.software_name,
      duplicate_row.normalized_version,
      duplicate_row.version_count,
      duplicate_row.original_versions;
  END LOOP;
END $$;

-- Step 3: Merge duplicate versions
-- This keeps the MOST COMPLETE entry (most notes, structured_notes, search_sources)
-- and deletes the others
DO $$
DECLARE
  duplicate_group RECORD;
  keeper_id UUID;
  keeper_record RECORD;
  duplicate_id UUID;
  merged_count INTEGER := 0;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Starting duplicate merge process...';
  RAISE NOTICE '============================================';

  -- Process each group of duplicates
  FOR duplicate_group IN
    SELECT
      svh.software_id,
      s.name as software_name,
      normalize_version(svh.version, s.name) as normalized_version,
      ARRAY_AGG(svh.id ORDER BY
        -- Prioritize by: 1) has notes, 2) has structured_notes, 3) has search_sources, 4) most recent
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
  LOOP
    -- The first ID is the "keeper" (most complete entry)
    keeper_id := duplicate_group.version_ids[1];

    -- Get the keeper record
    SELECT * INTO keeper_record
    FROM software_version_history
    WHERE id = keeper_id;

    RAISE NOTICE '';
    RAISE NOTICE 'Processing: % - %', duplicate_group.software_name, duplicate_group.normalized_version;
    RAISE NOTICE '  Original versions: %', duplicate_group.original_versions;
    RAISE NOTICE '  Keeping: % (ID: %)', keeper_record.version, keeper_id;

    -- Update keeper to use normalized version
    UPDATE software_version_history
    SET version = duplicate_group.normalized_version
    WHERE id = keeper_id;

    RAISE NOTICE '  Updated keeper to normalized version: %', duplicate_group.normalized_version;

    -- Delete all other duplicates
    FOR i IN 2..ARRAY_LENGTH(duplicate_group.version_ids, 1) LOOP
      duplicate_id := duplicate_group.version_ids[i];

      DELETE FROM software_version_history
      WHERE id = duplicate_id;

      RAISE NOTICE '  Deleted duplicate: %', duplicate_id;
      merged_count := merged_count + 1;
    END LOOP;

  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Merge complete! Removed % duplicate entries', merged_count;
  RAISE NOTICE '============================================';
END $$;

-- Step 4: Verify cleanup
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_duplicates
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
  ) duplicates;

  IF remaining_duplicates > 0 THEN
    RAISE WARNING 'WARNING: Still found % duplicate groups remaining!', remaining_duplicates;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✓ Verification passed: No duplicate versions remaining';
  END IF;
END $$;

-- Optional: Drop the normalize_version function if you don't need it for queries
-- COMMENT: Keeping it for now in case you want to use it for future queries
-- DROP FUNCTION IF EXISTS normalize_version(TEXT, TEXT);
