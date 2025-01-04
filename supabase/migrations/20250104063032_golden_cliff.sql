-- Add missing columns to software_version_history
ALTER TABLE software_version_history
ADD COLUMN IF NOT EXISTS notes text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('major', 'minor', 'patch')) DEFAULT 'patch';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_version_history_type ON software_version_history(type);
CREATE INDEX IF NOT EXISTS idx_version_history_version ON software_version_history(version);

-- Update existing rows with default notes
UPDATE software_version_history
SET notes = ARRAY['Version update detected']::text[]
WHERE notes IS NULL;

-- Add constraints
ALTER TABLE software_version_history
ALTER COLUMN notes SET DEFAULT ARRAY[]::text[],
ALTER COLUMN notes SET NOT NULL,
ALTER COLUMN type SET NOT NULL;