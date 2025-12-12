-- Fix RLS policies to avoid circular dependencies
-- The issue was duplicate/conflicting policies on admin_users causing infinite recursion

-- Remove ALL existing policies on admin_users to start fresh
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'admin_users')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON admin_users';
    END LOOP;
END $$;

-- Recreate only the essential admin_users policies (NO circular references)
CREATE POLICY "Users can read their own admin status" ON admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Disable RLS on premium_users entirely (admin-only table, no need for RLS)
ALTER TABLE premium_users DISABLE ROW LEVEL SECURITY;
