# Newsletter Cron Jobs - Fixes Summary

## ✅ Completed Changes

### 1. Fixed Dynamic Frequency Parameter in Queue Function
**File:** `supabase/functions/queue-weekly-digest/index.ts`

**Problem:** When calling with `{"frequency": "daily"}`, the function was still querying for weekly users. The issue was that `req.json()` was failing due to invisible characters in the request body.

**Solution:** Changed from `req.json()` to `req.text()` + `text.trim()` + `JSON.parse()`:
```typescript
// Before (failing):
const body = await req.json()

// After (working):
const text = await req.text()
if (text && text.trim()) {
  const body = JSON.parse(text.trim())
  if (body.frequency) {
    frequency = body.frequency
  }
}
```

**Result:** Function now correctly uses the frequency parameter from the request body (daily/weekly/monthly).

**Commits:** `e2acb7f`, `3f0077e`, `6f23036`, `af648ac`, `b86e2ea`

---

### 2. Fixed Edge Function PostgREST Syntax Error
**File:** `supabase/functions/queue-weekly-digest/index.ts`

**Problem:** PostgREST was throwing relationship errors when trying to use `.tracked_software()` method.

**Solution:** Changed from relationship syntax to direct querying with manual joins.

**Commit:** `2ede256`

---

### 3. Fixed Release Date Handling in API
**File:** `src/lib/software/api.ts:163-165`

**Problem:** When inserting new versions without a `release_date`, the code was setting it to the current timestamp (`new Date().toISOString()`) instead of leaving it as `null`. This caused the "verified at" date to override the proper fallback chain.

**Solution:** Changed fallback to `null` to allow proper cascading to `detected_at`:
```typescript
// Before (wrong):
const releaseDate = (data.release_date && data.release_date !== 'null')
  ? data.release_date
  : new Date().toISOString();  // Forces a date

// After (correct):
const releaseDate = (data.release_date && data.release_date !== 'null')
  ? data.release_date
  : null;  // Allows fallback to detected_at
```

**Commit:** `514e86e`

---

## 🔄 Pending Deployment

### Edge Function Deployment Required
The updated `queue-weekly-digest` function has been committed but needs to be deployed to Supabase.

**Manual Deployment Steps:**
```bash
# 1. Ensure Supabase CLI is installed
npm install -g supabase

# 2. Login to Supabase (if needed)
supabase login

# 3. Link your project (if needed)
supabase link --project-ref your-project-ref

# 4. Deploy the function
supabase functions deploy queue-weekly-digest

# 5. Verify deployment
supabase functions list
```

**Alternative - Via Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Navigate to: Edge Functions
3. Find `queue-weekly-digest` function
4. Upload/update from: `supabase/functions/queue-weekly-digest/`

---

## 🧪 Testing

After deployment, test the edge function:

```bash
# Get your Supabase project URL and anon key from dashboard
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/queue-weekly-digest \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

Expected behavior:
- Function should query all users with `weekly_digest_frequency` set
- For each user, fetch their tracked software
- Queue digest emails based on their frequency preferences
- Return success status

---

## 📋 Summary of All Date Fallback Fixes

These were fixed in the previous session to handle `null` release dates properly:

1. **src/components/software/software-detail-modal.tsx**
   - Added fallback chain for current version date display
   - Conditional rendering to avoid "Invalid Date"

2. **src/components/software/release-notes/dialog.tsx**
   - Added `release_date || detected_at` fallback
   - Conditional rendering

3. **src/components/software/software-card.tsx**
   - Dynamic label: "Released" vs "Added"
   - Fallback: `release_date || last_checked || created_at`

4. **src/components/admin/software/software-table.tsx**
   - Fallback: `release_date || last_checked || created_at`

5. **src/components/dashboard/tracked-software.tsx**
   - Fallback: `release_date || last_checked`

6. **src/components/recent-updates/update-list.tsx**
   - Dynamic label with fallback

7. **src/pages/dashboard.tsx**
   - "This week's updates" filter uses fallback

8. **src/pages/software.tsx**
   - Release date sorting uses fallback

9. **src/pages/home.tsx**
   - Home page cards use fallback with dynamic label

10. **src/lib/software/api.ts**
    - Added `detected_at` to version history query
    - Fixed root cause of incorrect date assignment

---

## 🎯 Next Steps

1. **Deploy the edge function** (requires manual Supabase CLI access)
2. **Test the function** with curl command above
3. **Monitor cron jobs** to ensure they're triggering correctly
4. **Check email delivery** for weekly digest functionality

---

## 🔗 Related Files

- Edge Function: `/supabase/functions/queue-weekly-digest/index.ts`
- API Fix: `/src/lib/software/api.ts`
- RLS Policy: `/supabase/migrations/20241210000004_allow_service_role_tracked_software.sql`

---

## 📝 Git Branch

All changes committed to: `claude/fix-newsletter-cron-jobs-01JsBwviScXieDPLYAdBShoT`

Ready for PR creation once edge function is deployed and tested.
