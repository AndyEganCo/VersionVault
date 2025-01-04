/*
  # Fix Version Check Policies

  1. Changes
    - Add insert policies for version_checks table
    - Add update policies for crawler_status table
    - Ensure proper RLS for all operations

  2. Security
    - Allow authenticated users to insert version checks
    - Allow authenticated users to read all version checks
    - Allow system to update crawler status
*/

-- Add insert policy for version checks
CREATE POLICY "Authenticated users can insert version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add update policy for crawler status
CREATE POLICY "System can update crawler status"
  ON crawler_status
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add insert policy for crawler status
CREATE POLICY "System can insert crawler status"
  ON crawler_status
  FOR INSERT
  TO authenticated
  WITH CHECK (true);