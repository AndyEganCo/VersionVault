/*
  # Fix Version Check Schema

  1. Changes
    - Drop existing version_checks table and recreate with correct schema
    - Drop existing crawler_status table and recreate with correct schema
    - Add proper indexes and policies
    - Add trigger for updating crawler stats

  2. Security
    - Enable RLS on both tables
    - Add read-only policies for authenticated users
*/

-- Drop existing tables and functions
DROP TABLE IF EXISTS version_checks CASCADE;
DROP TABLE IF EXISTS crawler_status CASCADE;
DROP FUNCTION IF EXISTS update_crawler_stats CASCADE;

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

CREATE POLICY "Anyone can read crawler status"
  ON crawler_status
  FOR SELECT
  TO authenticated
  USING (true);

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