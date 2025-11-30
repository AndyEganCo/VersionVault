# Database Setup Guide for VersionVault

This guide will help you set up the required database tables and columns in Supabase.

## Quick Setup

**IMPORTANT:** Run the SQL file first!

```bash
# Open the file: SETUP_USERS_TABLE.sql
# Copy all contents and paste into your Supabase SQL Editor
# Click "Run" to execute
```

This will automatically create the `users` table and set up triggers to keep it in sync with `auth.users`.

## Required Tables

### 1. users Table

This table mirrors `auth.users` in the public schema so you can easily query user information.

**Created automatically by SETUP_USERS_TABLE.sql**

**Columns:**
- `id` (UUID) - Primary key, references auth.users(id)
- `email` (TEXT) - User's email address
- `created_at` (TIMESTAMP) - When the user signed up
- `updated_at` (TIMESTAMP) - Last update time

**Features:**
- Automatically syncs with auth.users via triggers
- Backfills existing users when created
- Updates email when user changes it
- Accessible to all authenticated users (needed for admin panel)

### 2. admin_users Table

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

### 3. software_requests Table

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

### Issue: Can't see users in admin panel

**Possible causes:**
1. `users` table not created - Run SETUP_USERS_TABLE.sql
2. Users table empty - Check if trigger is set up correctly
3. RLS policy blocking access - Verify policies are in place

**Debug steps:**
1. Check if users table exists: `SELECT * FROM public.users LIMIT 5;`
2. Check user count: `SELECT COUNT(*) FROM public.users;`
3. If empty, run the backfill query from SETUP_USERS_TABLE.sql
4. Verify trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`

### Issue: New users not appearing in admin panel

**Possible causes:**
1. Trigger not working
2. RLS blocking the insert

**Solution:**
Re-run the trigger setup from SETUP_USERS_TABLE.sql, especially the `handle_new_user()` function and trigger creation.

## Questions?

If you encounter issues not covered here, check:
1. Supabase project logs
2. Browser developer console (Network tab and Console tab)
3. Table Editor to manually verify data
