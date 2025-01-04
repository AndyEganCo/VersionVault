/*
  # Add Release Notes Support

  1. Changes
    - Add notes column for storing release notes
    - Add type column for version type (major/minor/patch)
    - Add indexes for better query performance

  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns to software_version_history
ALTER TABLE software_version_history
ADD COLUMN IF NOT EXISTS notes text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('major', 'minor', 'patch')) DEFAULT 'patch';

-- Create indexes for better performance
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