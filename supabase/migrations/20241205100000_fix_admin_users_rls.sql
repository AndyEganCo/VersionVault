-- Fix admin_users RLS policy to allow users to check their own admin status
-- This fixes the circular dependency issue where users couldn't query admin_users
-- to check if they're an admin because the policy required them to already be an admin.

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can read admin_users" ON admin_users;

-- Create a new policy that allows users to check their own admin status
CREATE POLICY "Users can read their own admin status" ON admin_users
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Keep the insert and delete policies restricted to admins only
-- These should already exist, but we'll recreate them to be sure

DROP POLICY IF EXISTS "Admins can insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can delete admin_users" ON admin_users;

CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );
