-- Migration: Add manual current version override
-- Date: 2026-01-07
--
-- This adds a field to manually override which version is considered "current"
-- for edge cases where semantic versioning doesn't work correctly.

-- Add is_current_override column to software_version_history
ALTER TABLE software_version_history
ADD COLUMN is_current_override BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN software_version_history.is_current_override IS
'Manual override to force this version to be considered the current version, regardless of semantic versioning. Only one version per software should have this set to true.';

-- Create index for faster queries
CREATE INDEX idx_version_history_current_override
ON software_version_history(software_id, is_current_override)
WHERE is_current_override = TRUE;

-- Add a trigger to ensure only one version per software has is_current_override = true
CREATE OR REPLACE FUNCTION ensure_single_current_override()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_current_override to true
  IF NEW.is_current_override = TRUE THEN
    -- Set all other versions for this software to false
    UPDATE software_version_history
    SET is_current_override = FALSE
    WHERE software_id = NEW.software_id
      AND id != NEW.id
      AND is_current_override = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_current_override
BEFORE INSERT OR UPDATE ON software_version_history
FOR EACH ROW
WHEN (NEW.is_current_override = TRUE)
EXECUTE FUNCTION ensure_single_current_override();

COMMENT ON FUNCTION ensure_single_current_override() IS
'Ensures only one version per software can have is_current_override = true at a time';
