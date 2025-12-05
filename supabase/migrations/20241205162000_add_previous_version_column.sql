-- Add previous_version column to software_version_history
-- This tracks what version was replaced by the new version

ALTER TABLE software_version_history
  ADD COLUMN IF NOT EXISTS previous_version TEXT;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_software_version_history_previous_version
  ON software_version_history(previous_version);
