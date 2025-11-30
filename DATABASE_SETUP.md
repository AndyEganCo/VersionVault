# Database Setup Guide for VersionVault

This guide will help you set up the required database tables and columns in Supabase.

## Required Tables

### 1. admin_users Table

This table stores which users have admin privileges.

**Required Columns:**
```sql
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Row Level Security (RLS):**
```sql
-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all admin users
CREATE POLICY "Admins can read admin_users" ON admin_users
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Allow admins to insert new admins
CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Allow admins to delete admins
CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );
```

### 2. software_requests Table

This table stores user requests for tracking new software.

**Required Columns:**
```sql
CREATE TABLE software_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  version_url TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_software_requests_user_id ON software_requests(user_id);
CREATE INDEX idx_software_requests_status ON software_requests(status);
CREATE INDEX idx_software_requests_created_at ON software_requests(created_at DESC);
```

**Row Level Security (RLS):**
```sql
-- Enable RLS
ALTER TABLE software_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read own requests" ON software_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all requests
CREATE POLICY "Admins can read all requests" ON software_requests
  FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Authenticated users can insert requests
CREATE POLICY "Users can insert requests" ON software_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update request status
CREATE POLICY "Admins can update requests" ON software_requests
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Users can delete their own requests
CREATE POLICY "Users can delete own requests" ON software_requests
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any request
CREATE POLICY "Admins can delete any request" ON software_requests
  FOR DELETE
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );
```

## Initial Setup

### 1. Create Your First Admin User

After creating the `admin_users` table, you need to manually add your first admin:

1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Copy your user ID (UUID)
4. Go to Table Editor > admin_users
5. Click "Insert row"
6. Paste your user ID into the `user_id` field
7. Click Save

### 2. Verify Tables Exist

Run this query in the SQL Editor to check all tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 3. Verify Columns

Check the software_requests table columns:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'software_requests'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- name (text)
- website (text)
- version_url (text)
- description (text)
- user_id (uuid)
- status (text)
- created_at (timestamp with time zone)

## Troubleshooting

### Issue: "column does not exist" errors

**Solution:** Make sure you're using the exact column names shown above. Supabase uses snake_case (e.g., `user_id`, `created_at`, `version_url`).

### Issue: "permission denied" errors

**Solution:** Check that RLS policies are set up correctly and match the policies shown above.

### Issue: Software requests not showing up

**Possible causes:**
1. RLS policies not configured - users can't read their own data
2. Wrong column names - check that all columns exist with correct names
3. Insert failed silently - check browser console for errors

**Debug steps:**
1. Check browser console for detailed error messages
2. Try disabling RLS temporarily to test (NOT recommended for production)
3. Verify user_id matches between auth.users and your requests

### Issue: Can't add new admins

**Possible causes:**
1. Not logged in as an existing admin
2. RLS policy preventing insert
3. Invalid user_id format

**Debug steps:**
1. Verify you're in the admin_users table
2. Check that your current user_id is in admin_users
3. Ensure the user_id you're adding is a valid UUID from auth.users

## Optional: Create a users Table

If you want to display user emails instead of UUIDs in the admin panel, you can create a users table:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a trigger to auto-populate this table when users sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill existing users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

Then update the admin_users table to include email via join in your queries.

## Questions?

If you encounter issues not covered here, check:
1. Supabase project logs
2. Browser developer console (Network tab and Console tab)
3. Table Editor to manually verify data
