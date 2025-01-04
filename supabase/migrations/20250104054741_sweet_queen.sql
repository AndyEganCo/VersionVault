/*
  # Software Version History Schema

  1. New Tables
    - software_version_history: Track version changes over time

  2. Security
    - Enable RLS on version history table
    - Add policies for read/write access
*/

-- Create version history table if it doesn't exist
CREATE TABLE IF NOT EXISTS software_version_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id text REFERENCES software(id),
  version text NOT NULL,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on version history
ALTER TABLE software_version_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can read version history" ON software_version_history;
  DROP POLICY IF EXISTS "Only admins can modify version history" ON software_version_history;
END $$;

-- Create new policies
CREATE POLICY "Anyone can read version history"
  ON software_version_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify version history"
  ON software_version_history
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create or replace version update function
CREATE OR REPLACE FUNCTION update_software_version(
  software_id text,
  new_version text
)
RETURNS void AS $$
BEGIN
  -- Insert into version history
  INSERT INTO software_version_history (software_id, version)
  VALUES (software_id, new_version);

  -- Update software table
  UPDATE software
  SET 
    current_version = new_version,
    last_checked = now(),
    updated_at = now()
  WHERE id = software_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'software_version_history' AND indexname = 'idx_version_history_software_id'
  ) THEN
    CREATE INDEX idx_version_history_software_id ON software_version_history(software_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'software_version_history' AND indexname = 'idx_version_history_detected_at'
  ) THEN
    CREATE INDEX idx_version_history_detected_at ON software_version_history(detected_at DESC);
  END IF;
END $$;