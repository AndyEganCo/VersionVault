# Supabase Setup Instructions

This document explains how to set up the VersionVault database with proper Row Level Security policies.

## Problem: Software Not Showing on Public Home Page

The home page needs to display all software versions to **unauthenticated visitors**. However, Supabase Row Level Security (RLS) blocks anonymous access by default.

## Solution: Enable Public Read Access

### Option 1: Run SQL via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL:

```sql
-- Enable RLS on tables (if not already enabled)
ALTER TABLE software ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_version_history ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to software table
DROP POLICY IF EXISTS "Public read access to software" ON software;
CREATE POLICY "Public read access to software"
ON software
FOR SELECT
TO anon, authenticated
USING (true);

-- Create policies for public read access to version history table
DROP POLICY IF EXISTS "Public read access to version history" ON software_version_history;
CREATE POLICY "Public read access to version history"
ON software_version_history
FOR SELECT
TO anon, authenticated
USING (true);
```

### Option 2: Use Supabase CLI

If you have the Supabase CLI set up locally:

```bash
supabase db push
```

This will apply the migration in `supabase/migrations/enable_public_read.sql`

## Verify Setup

After applying the policies:

1. Visit https://www.versionvault.dev
2. You should see all software displayed on the home page
3. Open browser console (F12) - there should be no Supabase errors

## Security Considerations

**What's Safe:**
- ✅ Public read access to software list is safe
- ✅ Software names, versions, and release dates are intended to be public
- ✅ This is the core value proposition of the product

**What's Protected:**
- 🔒 User data (tracked_software table should remain private)
- 🔒 Admin operations (INSERT/UPDATE/DELETE on software tables)
- 🔒 User profiles and settings

## Additional Policies You May Need

### Protected: User Tracking Data

```sql
-- Users can only see their own tracked software
CREATE POLICY "Users can view own tracked software"
ON tracked_software
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can track software"
ON tracked_software
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can untrack software"
ON tracked_software
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

### Admin-Only Write Access

```sql
-- Only admins can modify software entries
CREATE POLICY "Admin write access to software"
ON software
FOR ALL
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM admin_users)
);
```

## Troubleshooting

### Still not seeing software?

1. **Check RLS is enabled**: In Supabase Dashboard → Database → Tables → software → Check "Enable RLS"
2. **Verify policies exist**: Click "View Policies" on the software table
3. **Check browser console**: Look for specific error messages
4. **Test the query**: In SQL Editor, run: `SELECT * FROM software;` (should work even when not authenticated)

### Common Errors

**Error: "row-level security policy for table 'software' prevents access"**
- Solution: Run the SQL policies above

**Error: "JWT expired" or "Invalid token"**
- This shouldn't affect the public home page (it doesn't need auth)
- Check that you're using `supabase.from('software')` not requiring a session

**No error but no data showing**
- Check that data exists: Run `SELECT COUNT(*) FROM software;` in SQL Editor
- Verify the `software` table has data
