/*
  # Version Check System

  1. New Tables
    - `version_checks`: Stores results of manual version checks
    - `crawler_status`: Tracks crawler statistics and status

  2. Changes
    - Add indexes for better query performance
    - Add RLS policies for security
    - Add trigger for updating crawler stats
*/

-- Version Check Results Table
CREATE TABLE IF NOT EXISTS version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id text NOT NULL,
  url text NOT NULL,
  detected_version text,
  current_version text,
  content text,
  status text NOT NULL,
  error text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Crawler Status Table
CREATE TABLE IF NOT EXISTS crawler_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_check timestamptz,
  status text DEFAULT 'idle',
  error text,
  updated_at timestamptz DEFAULT now()
);

-- Add success and error count columns
ALTER TABLE crawler_status 
ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_version_checks_software_id ON version_checks(software_id);
CREATE INDEX IF NOT EXISTS idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can read version checks" ON version_checks;
  DROP POLICY IF EXISTS "Anyone can read crawler status" ON crawler_status;
END $$;

-- Create new policies
CREATE POLICY "Anyone can read version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read crawler status"
  ON crawler_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert initial crawler status if not exists
INSERT INTO crawler_status (status)
SELECT 'idle'
WHERE NOT EXISTS (SELECT 1 FROM crawler_status);

-- Function to update crawler stats
CREATE OR REPLACE FUNCTION update_crawler_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crawler_status
  SET 
    success_count = CASE 
      WHEN NEW.status = 'success' THEN success_count + 1
      ELSE success_count
    END,
    error_count = CASE 
      WHEN NEW.status = 'error' THEN error_count + 1
      ELSE error_count
    END,
    last_check = NEW.checked_at,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_crawler_stats_trigger ON version_checks;

-- Create new trigger
CREATE TRIGGER update_crawler_stats_trigger
  AFTER INSERT ON version_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_crawler_stats();