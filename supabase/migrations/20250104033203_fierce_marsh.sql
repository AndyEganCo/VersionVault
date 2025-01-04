/*
  # Add Crawler Status Tables

  1. New Tables
    - `crawler_status`: Tracks the status of different crawlers
    - `version_checks`: Records version check history

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read data
*/

-- Crawler Status Table
CREATE TABLE crawler_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  last_run timestamptz,
  success_rate integer DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Version Checks History
CREATE TABLE version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id text NOT NULL,
  old_version text,
  new_version text,
  status text NOT NULL,
  error text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE crawler_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read crawler status"
  ON crawler_status
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert initial crawler data
INSERT INTO crawler_status (name, status, success_rate) VALUES
  ('Puppeteer', 'idle', 0),
  ('Crawler4AI', 'idle', 0);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for crawler_status
CREATE TRIGGER update_crawler_status_updated_at
  BEFORE UPDATE ON crawler_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();