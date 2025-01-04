/*
  # Add Release Notes Support

  1. New Columns
    - Add notes array and type to software_version_history
    - Add constraints for valid version types
  
  2. Indexes
    - Add index on type column for better query performance
*/

-- Add release notes columns
ALTER TABLE software_version_history
ADD COLUMN IF NOT EXISTS notes text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('major', 'minor', 'patch')) DEFAULT 'patch';

-- Create index for version type
CREATE INDEX IF NOT EXISTS idx_version_history_type 
ON software_version_history(type);

-- Update existing rows with default notes
UPDATE software_version_history
SET notes = ARRAY['Version update detected']::text[]
WHERE notes IS NULL;

-- Add constraint to ensure notes array is not null
ALTER TABLE software_version_history
ALTER COLUMN notes SET DEFAULT ARRAY[]::text[],
ALTER COLUMN notes SET NOT NULL;