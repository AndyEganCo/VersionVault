/*
  # Fix Version Checks Schema and Policies

  1. Changes
    - Drop existing version checks table and policies
    - Create new version checks table with proper schema
    - Add comprehensive RLS policies
    - Add proper indexes for performance

  2. Security
    - Enable RLS
    - Add policies for read and write operations
    - Ensure authenticated users can perform necessary operations
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS version_checks CASCADE;

-- Create version checks table with proper schema
CREATE TABLE version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  software_id text NOT NULL,
  url text NOT NULL,
  detected_version text,
  current_version text,
  status text NOT NULL,
  error text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_version_checks_user_id ON version_checks(user_id);
CREATE INDEX idx_version_checks_software_id ON version_checks(software_id);
CREATE INDEX idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies
CREATE POLICY "Users can read own version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);