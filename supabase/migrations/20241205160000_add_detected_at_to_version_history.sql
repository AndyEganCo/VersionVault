-- Add detected_at column to software_version_history if it doesn't exist
-- This column is used for newsletter queries to find recent version updates

ALTER TABLE software_version_history
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;

-- Populate detected_at for existing rows that don't have it set
-- Use created_at as the detected_at value for historical data
UPDATE software_version_history
SET detected_at = created_at
WHERE detected_at IS NULL;

-- Set default for future inserts
ALTER TABLE software_version_history
  ALTER COLUMN detected_at SET DEFAULT now();

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_software_version_history_detected_at
  ON software_version_history(detected_at DESC);
