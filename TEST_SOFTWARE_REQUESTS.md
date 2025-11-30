# Testing Software Requests

## Issue: Requests not saving to database

### Step 1: Check if RLS is blocking inserts

Run this in your Supabase SQL Editor:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'software_requests';

-- See all policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'software_requests';
```

If you see `rowsecurity = true` but NO policies, that's the problem!

### Step 2: Apply RLS Policies

**IMPORTANT:** Run the file `SETUP_SOFTWARE_REQUESTS_RLS.sql`

1. Open SETUP_SOFTWARE_REQUESTS_RLS.sql
2. Copy all contents
3. Paste in Supabase SQL Editor
4. Click Run

This will set up the correct policies so:
- Users can insert their own requests
- Users can see their own requests
- Admins can see all requests
- Admins can approve/reject/delete any request

### Step 3: Test inserting a request

After setting up RLS, try submitting a software request in the app.

Check browser console for errors. Common errors:

**Error: "new row violates row-level security policy"**
- Solution: The RLS policy for INSERT is blocking you
- Fix: Make sure you ran SETUP_SOFTWARE_REQUESTS_RLS.sql

**Error: "Failed to submit software request"**
- Open browser DevTools (F12)
- Go to Console tab
- Look for the actual error message
- Share that error for more specific help

### Step 4: Verify data in database

Run this query in Supabase:

```sql
SELECT id, name, user_id, status, created_at
FROM public.software_requests
ORDER BY created_at DESC
LIMIT 10;
```

If you see your requests here, the insert worked!

### Step 5: About Approvals

**IMPORTANT:** Approving a request does NOT automatically add it to the software table!

When you approve a request, it:
1. Changes status from 'pending' to 'approved'
2. Shows a reminder message
3. **You must manually add the software** via "Manage Software"

#### How to add approved software:

1. Note down the software name, website, and version URL from the request
2. Go to `/admin/software` (Manage Software)
3. Click "Add Software"
4. Fill in the form with the details from the request
5. Save

#### Future Enhancement Idea:

We could add a "Quick Add to Software" button that pre-fills the Add Software form with the request details. Let me know if you want this feature!

### Step 6: Debug checklist

If requests still aren't working:

- [ ] RLS policies are set up (ran SETUP_SOFTWARE_REQUESTS_RLS.sql)
- [ ] User is logged in (check if user object exists in auth context)
- [ ] No errors in browser console
- [ ] Table exists with correct columns (check Supabase Table Editor)
- [ ] User ID in request matches auth.uid()

### Common Issues:

**"I can submit but don't see my requests"**
- Check the `/requests` page
- Non-admins only see their own requests
- Admins see everyone's requests

**"Approve/Reject buttons don't work"**
- Only admins can approve/reject
- Check if you're logged in as an admin
- Verify admin_users table has your user_id

**"Requests disappear after submit"**
- Check if they're in the database (Step 4)
- If not in DB, it's an RLS issue
- If in DB but not showing, check the fetch logic
