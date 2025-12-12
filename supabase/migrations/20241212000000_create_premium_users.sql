-- Create premium_users table to track users with premium subscriptions
CREATE TABLE IF NOT EXISTS premium_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE premium_users ENABLE ROW LEVEL SECURITY;

-- Allow users to check their own premium status
CREATE POLICY "Users can read their own premium status" ON premium_users
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Allow admins to manage premium users
CREATE POLICY "Admins can insert premium_users" ON premium_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

CREATE POLICY "Admins can delete premium_users" ON premium_users
  FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_premium_users_user_id ON premium_users(user_id);
