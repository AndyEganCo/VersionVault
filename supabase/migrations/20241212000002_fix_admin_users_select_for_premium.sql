-- Create a helper function to check if current user is admin
-- This avoids RLS issues when checking admin status in other policies

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate premium_users policies using the helper function

DROP POLICY IF EXISTS "Admins can insert premium_users" ON premium_users;
DROP POLICY IF EXISTS "Admins can update premium_users" ON premium_users;
DROP POLICY IF EXISTS "Admins can delete premium_users" ON premium_users;

CREATE POLICY "Admins can insert premium_users" ON premium_users
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update premium_users" ON premium_users
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete premium_users" ON premium_users
  FOR DELETE
  USING (public.is_admin());
