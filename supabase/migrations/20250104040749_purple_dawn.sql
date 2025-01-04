/*
  # Version Checker Schema

  1. New Tables
    - `version_checks`
      - Stores results of version checks
      - Includes URL, detected version, and status
    - `crawler_status` 
      - Tracks automated crawler statistics
      - Monitors success/failure rates

  2. Security
    - Enable RLS on all tables
    - Allow authenticated users to read and create checks
    - Allow system to manage crawler status
*/

-- Version Check Results Table
CREATE TABLE version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id text NOT NULL,
  url text NOT NULL,
  detected_version text,
  current_version text,
  status text NOT NULL,
  error text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Crawler Status Table
CREATE TABLE crawler_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_check timestamptz,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text DEFAULT 'idle',
  error text,
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_version_checks_software_id ON version_checks(software_id);
CREATE INDEX idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_status ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can manage crawler status"
  ON crawler_status
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial crawler status
INSERT INTO crawler_status (status, success_count, error_count)
VALUES ('idle', 0, 0);

-- Create function to update crawler stats
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

-- Create trigger
CREATE TRIGGER update_crawler_stats_trigger
  AFTER INSERT ON version_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_crawler_stats();