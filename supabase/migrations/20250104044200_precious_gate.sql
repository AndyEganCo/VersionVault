/*
  # Version Checks Schema Update

  1. Changes
    - Add software table for proper relationships
    - Update version checks schema with user_id
    - Add admin policies
    - Create stats view
  
  2. Security
    - Only admins can access all version checks
    - Regular users can only see their own checks
*/

-- Create software table if not exists
CREATE TABLE IF NOT EXISTS software (
  id text PRIMARY KEY,
  name text NOT NULL,
  manufacturer text NOT NULL,
  website text NOT NULL,
  current_version text,
  last_checked timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Drop and recreate version_checks table
DROP TABLE IF EXISTS version_checks CASCADE;

CREATE TABLE version_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  url text NOT NULL,
  software_id text REFERENCES software(id),
  detected_version text,
  current_version text,
  status text NOT NULL,
  error text,
  content text,
  source text,
  confidence text,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_version_checks_user_id ON version_checks(user_id);
CREATE INDEX idx_version_checks_software_id ON version_checks(software_id);
CREATE INDEX idx_version_checks_checked_at ON version_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE version_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE software ENABLE ROW LEVEL SECURITY;

-- Create admin function
CREATE OR REPLACE FUNCTION is_admin(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email = 'andy@andyegan.co';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
CREATE POLICY "Version check access"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    is_admin(auth.jwt() ->> 'email')
  );

CREATE POLICY "Users can create version checks"
  ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read software"
  ON software
  FOR SELECT
  TO authenticated
  USING (true);

-- Create stats view
CREATE OR REPLACE VIEW version_check_stats AS
SELECT
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE status = 'success') as successful_checks,
  COUNT(*) FILTER (WHERE status = 'error') as failed_checks,
  COUNT(*) FILTER (WHERE detected_version != current_version) as new_versions,
  MAX(checked_at) as last_check
FROM version_checks
WHERE checked_at >= NOW() - INTERVAL '24 hours';

-- Insert initial software data
INSERT INTO software (id, name, manufacturer, website)
VALUES 
  ('propresenter', 'ProPresenter', 'Renewed Vision', 'https://renewedvision.com/propresenter/')
ON CONFLICT (id) DO NOTHING;