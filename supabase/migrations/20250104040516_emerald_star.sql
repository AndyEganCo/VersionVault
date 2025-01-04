/*
  # Fix Version Check Policies

  1. Changes
    - Drop and recreate all policies for version_checks table
    - Add comprehensive RLS policies for all operations
    - Ensure proper security while allowing necessary operations

  2. Security
    - Allow authenticated users to insert and read version checks
    - Allow system to manage crawler status
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read version checks" ON version_checks;
DROP POLICY IF EXISTS "Authenticated users can insert version checks" ON version_checks;

-- Create comprehensive policies for version_checks
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

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;

-- Ensure crawler_status policies are correct
DROP POLICY IF EXISTS "System can update crawler status" ON crawler_status;
DROP POLICY IF EXISTS "System can insert crawler status" ON crawler_status;

CREATE POLICY "Anyone can manage crawler status"
  ON crawler_status
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);