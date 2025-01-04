/*
  # Fix Manual Version Check

  1. Changes
    - Drop and recreate version_checks table with proper schema
    - Make software_id optional
    - Add proper indexes and RLS policies

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing table
DROP TABLE IF EXISTS version_checks CASCADE;

-- Create version checks table
CREATE TABLE version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  url text NOT NULL,
  software_id text, -- Optional reference to known software
  detected_version text,
  current_version text,
  status text NOT NULL,
  error text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_version_checks_user_id ON version_checks(user_id);
CREATE INDEX idx_version_checks_software_id ON version_checks(software_id) WHERE software_id IS NOT NULL;
CREATE INDEX idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);