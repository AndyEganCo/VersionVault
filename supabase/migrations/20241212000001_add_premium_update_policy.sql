-- Add UPDATE policy for premium_users
-- This is needed for upsert operations which can trigger UPDATE when row exists

CREATE POLICY "Admins can update premium_users" ON premium_users
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );
