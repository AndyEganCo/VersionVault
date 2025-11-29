-- Enable public read access for software and version history tables
-- This allows the public home page to display software versions without authentication

-- Enable RLS on tables (if not already enabled)
ALTER TABLE software ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_version_history ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to software table
DROP POLICY IF EXISTS "Public read access to software" ON software;
CREATE POLICY "Public read access to software"
ON software
FOR SELECT
TO anon, authenticated
USING (true);

-- Create policies for public read access to software_version_history table
DROP POLICY IF EXISTS "Public read access to version history" ON software_version_history;
CREATE POLICY "Public read access to version history"
ON software_version_history
FOR SELECT
TO anon, authenticated
USING (true);

-- Keep existing policies for authenticated users (INSERT, UPDATE, DELETE)
-- Admins should have full access, regular users should only track software

-- Example: If you have admin-only write policies, they would look like this:
-- CREATE POLICY "Admin write access to software" ON software
-- FOR ALL
-- TO authenticated
-- USING (auth.uid() IN (SELECT user_id FROM admin_users))
-- WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
