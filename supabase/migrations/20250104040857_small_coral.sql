/*
  # Fix Version Checks Schema

  1. Changes
    - Drop and recreate version_checks table with proper structure
    - Add proper RLS policies
    - Add indexes for better performance

  2. Security
    - Enable RLS
    - Allow authenticated users to read and create checks
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS version_checks CASCADE;

-- Create version checks table
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

-- Create indexes
CREATE INDEX idx_version_checks_software_id ON version_checks(software_id);
CREATE INDEX idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can create version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);