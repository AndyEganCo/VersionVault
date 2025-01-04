/*
  # Add admin users table and update policies

  1. New Tables
    - `admin_users`
      - `user_id` (uuid, primary key, references auth.users)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on `admin_users` table
    - Add policies for admin access
    - Update version checks policies to use admin_users table
*/

-- Create admin users table
CREATE TABLE admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policies for admin_users table
CREATE POLICY "Admins can read admin_users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage admin_users"
  ON admin_users
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Update version checks policies
DROP POLICY IF EXISTS "Version check access" ON version_checks;

CREATE POLICY "Version check access"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    is_admin()
  );

-- Insert initial admin users
INSERT INTO admin_users (user_id, created_by)
SELECT 
  id as user_id,
  id as created_by
FROM auth.users
WHERE email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ON CONFLICT (user_id) DO NOTHING;