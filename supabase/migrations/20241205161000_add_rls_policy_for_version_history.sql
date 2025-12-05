-- Add RLS policy to allow authenticated users to read software_version_history
-- This is needed for newsletter test emails and other user-facing features

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view version history" ON software_version_history;
DROP POLICY IF EXISTS "Users can view all version history" ON software_version_history;

-- Allow all authenticated users to read version history
CREATE POLICY "Authenticated users can view version history"
  ON software_version_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Also ensure service role can do everything
DROP POLICY IF EXISTS "Service role can manage version history" ON software_version_history;
CREATE POLICY "Service role can manage version history"
  ON software_version_history
  FOR ALL
  USING (auth.role() = 'service_role');
