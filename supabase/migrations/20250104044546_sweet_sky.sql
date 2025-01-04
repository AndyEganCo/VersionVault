-- Update admin function to include both email addresses
CREATE OR REPLACE FUNCTION is_admin(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email IN ('andy@andyegan.co', 'theandyegan@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh existing policies that use the is_admin function
DO $$ 
BEGIN
  -- Drop and recreate version checks policies to ensure they use the updated function
  DROP POLICY IF EXISTS "Version check access" ON version_checks;
  
  CREATE POLICY "Version check access"
    ON version_checks
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = user_id OR
      is_admin(auth.jwt() ->> 'email')
    );
END $$;