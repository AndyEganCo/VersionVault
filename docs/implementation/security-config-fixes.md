# Security Configuration Fixes

This document outlines the remaining security issues that must be fixed via the Supabase Dashboard configuration settings.

---

## ⚠️ Configuration Issues to Fix

These issues cannot be fixed via SQL migrations and must be addressed in your Supabase Dashboard.

### 1. Auth OTP Long Expiry ⚠️

**Issue:** Email OTP tokens expire after more than 1 hour (recommended: ≤ 60 minutes)

**Security Risk:** Longer expiry windows increase the window for token interception or brute force attacks.

**How to Fix:**

1. Go to your Supabase Dashboard: https://idlkxmbymqduafgatdwd.supabase.co
2. Navigate to **Authentication** → **Settings**
3. Find **OTP Expiry** setting (under Email provider settings)
4. Set it to **3600 seconds (1 hour)** or less
5. Click **Save**

**Recommended Value:** 3600 seconds (1 hour) or 1800 seconds (30 minutes)

---

### 2. Leaked Password Protection Disabled ⚠️

**Issue:** Integration with HaveIBeenPwned.org is currently disabled

**Security Risk:** Users can set passwords that are known to be compromised/leaked in data breaches.

**How to Fix:**

1. Go to your Supabase Dashboard: https://idlkxmbymqduafgatdwd.supabase.co
2. Navigate to **Authentication** → **Settings**
3. Scroll to **Password Security** section
4. Enable **"Check for leaked passwords"**
5. This will check passwords against the HaveIBeenPwned database
6. Click **Save**

**Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

### 3. Vulnerable Postgres Version ⚠️

**Issue:** Running `supabase-postgres-15.8.1.022` which has available security patches

**Security Risk:** Missing security patches could expose your database to known vulnerabilities.

**How to Fix:**

1. Go to your Supabase Dashboard: https://idlkxmbymqduafgatdwd.supabase.co
2. Navigate to **Database** → **Settings**
3. Look for **Database Version** or **Upgrade** section
4. Click **Upgrade** to apply the latest security patches
5. Follow the upgrade wizard

**Important Notes:**
- Upgrades are typically non-breaking for patch versions
- Always review the changelog before upgrading
- Consider doing this during low-traffic hours
- Supabase will perform the upgrade with minimal downtime

**Reference:** https://supabase.com/docs/guides/platform/upgrading

---

## ✅ SQL Migration Fixes (Already Created)

The following issues have been fixed via SQL migrations in this PR:

1. ✅ **scraping_patterns RLS** - Enabled Row Level Security
2. ✅ **flagged_versions view** - Fixed SECURITY DEFINER issue
3. ✅ **Function search_path** - Added to 6 SECURITY DEFINER functions
4. ✅ **Function search_path** - Added to 5 remaining functions

---

## Application Process

### For SQL Migrations:

Apply all migration files in order via Supabase SQL Editor:

```bash
supabase/migrations/20251211202339_fix_scraping_patterns_rls.sql
supabase/migrations/20251211202559_fix_flagged_versions_view.sql
supabase/migrations/20251211202639_fix_security_definer_search_path.sql
supabase/migrations/20251211202719_fix_remaining_function_search_paths.sql
```

**OR** if you have Supabase CLI:
```bash
supabase db push
```

### For Configuration Fixes:

Follow the step-by-step instructions above for each configuration issue in the Supabase Dashboard.

---

## Verification

After applying all fixes, you should re-run the Supabase Database Linter to verify all issues are resolved:

1. Go to **Database** → **Database Health** in your Supabase Dashboard
2. Click **Run Linter** or refresh the page
3. Verify that all ERROR and WARN level security issues are resolved

---

## Summary

**Total Issues:** 25
- **CRITICAL (ERROR):** 2 → ✅ Fixed via migrations
- **HIGH (WARN - Functions):** 20 → ✅ Fixed via migrations
- **MEDIUM (WARN - Config):** 3 → ⚠️ Requires manual configuration

**Estimated Time to Complete Configuration Fixes:** 5-10 minutes
