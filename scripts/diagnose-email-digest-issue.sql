-- =============================================
-- DIAGNOSTIC SCRIPT FOR EMAIL DIGEST ISSUES
-- =============================================
-- Checking why andy@andyegan.co and theandyegan@gmail.com
-- aren't receiving email digests
-- =============================================

-- ============================================
-- 1. Check if users exist in auth.users
-- ============================================
\echo '=== 1. Checking if users exist in auth.users ==='
SELECT
  id,
  email,
  created_at,
  confirmed_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY email;

-- ============================================
-- 2. Check user_settings table
-- ============================================
\echo ''
\echo '=== 2. Checking user_settings for these users ==='
SELECT
  us.user_id,
  au.email,
  us.email_notifications,
  us.notification_frequency,
  us.app_update_notifications,
  us.timezone,
  us.created_at,
  us.updated_at
FROM public.user_settings us
JOIN auth.users au ON us.user_id = au.id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY au.email;

-- ============================================
-- 3. Check if settings are missing (NULL check)
-- ============================================
\echo ''
\echo '=== 3. Checking for missing user_settings entries ==='
SELECT
  au.id,
  au.email,
  CASE
    WHEN us.user_id IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END as settings_status
FROM auth.users au
LEFT JOIN public.user_settings us ON au.id = us.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY au.email;

-- ============================================
-- 4. Check tracked software count
-- ============================================
\echo ''
\echo '=== 4. Checking tracked software count ==='
SELECT
  au.email,
  COUNT(ts.software_id) as tracked_software_count
FROM auth.users au
LEFT JOIN public.tracked_software ts ON au.id = ts.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email
ORDER BY au.email;

-- ============================================
-- 5. Check email bounces
-- ============================================
\echo ''
\echo '=== 5. Checking email bounces (last 30 days) ==='
SELECT
  au.email,
  eb.bounce_type,
  COUNT(*) as bounce_count,
  MAX(eb.created_at) as last_bounce,
  eb.reason
FROM auth.users au
LEFT JOIN public.email_bounces eb ON au.id = eb.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
  AND eb.created_at >= NOW() - INTERVAL '30 days'
GROUP BY au.email, eb.bounce_type, eb.reason
ORDER BY au.email, eb.bounce_type;

-- ============================================
-- 6. Check newsletter_queue entries
-- ============================================
\echo ''
\echo '=== 6. Checking newsletter_queue (last 14 days) ==='
SELECT
  au.email,
  nq.email_type,
  nq.status,
  nq.scheduled_for,
  nq.created_at,
  nq.sent_at,
  nq.attempts,
  nq.last_error,
  nq.idempotency_key
FROM auth.users au
LEFT JOIN public.newsletter_queue nq ON au.id = nq.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
  AND nq.created_at >= NOW() - INTERVAL '14 days'
ORDER BY au.email, nq.created_at DESC;

-- ============================================
-- 7. Check newsletter_logs entries
-- ============================================
\echo ''
\echo '=== 7. Checking newsletter_logs (last 30 days) ==='
SELECT
  au.email,
  nl.email_type,
  nl.status,
  nl.created_at,
  nl.opened_at,
  nl.clicked_at,
  nl.bounced_at,
  array_length(nl.software_updates, 1) as update_count
FROM auth.users au
LEFT JOIN public.newsletter_logs nl ON au.id = nl.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
  AND nl.created_at >= NOW() - INTERVAL '30 days'
ORDER BY au.email, nl.created_at DESC;

-- ============================================
-- 8. Check resend_contact_sync status
-- ============================================
\echo ''
\echo '=== 8. Checking resend_contact_sync status ==='
SELECT
  au.email,
  rcs.sync_status,
  rcs.resend_contact_id,
  rcs.last_synced_at,
  rcs.last_error,
  rcs.created_at,
  rcs.updated_at
FROM auth.users au
LEFT JOIN public.resend_contact_sync rcs ON au.id = rcs.user_id
WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY au.email;

-- ============================================
-- 9. Full diagnostic summary
-- ============================================
\echo ''
\echo '=== 9. DIAGNOSTIC SUMMARY ==='
WITH user_data AS (
  SELECT
    au.id,
    au.email,
    us.email_notifications,
    us.notification_frequency,
    COUNT(DISTINCT ts.software_id) as tracked_count,
    COUNT(DISTINCT CASE
      WHEN eb.bounce_type = 'hard'
        AND eb.created_at >= NOW() - INTERVAL '30 days'
      THEN eb.id
    END) as hard_bounce_count,
    MAX(nq.created_at) as last_queued,
    MAX(nl.created_at) as last_sent
  FROM auth.users au
  LEFT JOIN public.user_settings us ON au.id = us.user_id
  LEFT JOIN public.tracked_software ts ON au.id = ts.user_id
  LEFT JOIN public.email_bounces eb ON au.id = eb.user_id
  LEFT JOIN public.newsletter_queue nq ON au.id = nq.user_id
  LEFT JOIN public.newsletter_logs nl ON au.id = nl.user_id
  WHERE au.email IN ('andy@andyegan.co', 'theandyegan@gmail.com')
  GROUP BY au.id, au.email, us.email_notifications, us.notification_frequency
)
SELECT
  email,
  CASE
    WHEN email_notifications IS NULL THEN '❌ NO SETTINGS ROW'
    WHEN email_notifications = false THEN '❌ DISABLED'
    ELSE '✅ ENABLED'
  END as notification_status,
  notification_frequency,
  tracked_count,
  hard_bounce_count,
  CASE
    WHEN hard_bounce_count >= 3 THEN '❌ TOO MANY BOUNCES'
    ELSE '✅ OK'
  END as bounce_status,
  CASE
    WHEN tracked_count = 0 THEN '⚠️  NO TRACKED SOFTWARE'
    ELSE '✅ HAS TRACKED SOFTWARE'
  END as tracking_status,
  last_queued,
  last_sent,
  CASE
    WHEN email_notifications IS NULL THEN 'Missing user_settings entry'
    WHEN email_notifications = false THEN 'Email notifications disabled'
    WHEN hard_bounce_count >= 3 THEN 'Too many hard bounces'
    WHEN tracked_count = 0 THEN 'No tracked software'
    WHEN last_queued IS NULL THEN 'Never queued - check cron job'
    WHEN last_sent IS NULL THEN 'Queued but not sent - check processor'
    ELSE 'Should be working - check edge function logs'
  END as likely_issue
FROM user_data
ORDER BY email;

-- ============================================
-- 10. Check all users with same issue pattern
-- ============================================
\echo ''
\echo '=== 10. Finding other users with similar issues ==='
WITH user_data AS (
  SELECT
    au.id,
    au.email,
    us.email_notifications,
    us.notification_frequency,
    COUNT(DISTINCT ts.software_id) as tracked_count,
    COUNT(DISTINCT CASE
      WHEN eb.bounce_type = 'hard'
        AND eb.created_at >= NOW() - INTERVAL '30 days'
      THEN eb.id
    END) as hard_bounce_count
  FROM auth.users au
  LEFT JOIN public.user_settings us ON au.id = us.user_id
  LEFT JOIN public.tracked_software ts ON au.id = ts.user_id
  LEFT JOIN public.email_bounces eb ON au.id = eb.user_id
  GROUP BY au.id, au.email, us.email_notifications, us.notification_frequency
)
SELECT
  COUNT(*) as affected_users,
  CASE
    WHEN email_notifications IS NULL THEN 'Missing user_settings'
    WHEN email_notifications = false THEN 'Notifications disabled'
    WHEN hard_bounce_count >= 3 THEN 'Too many bounces'
    WHEN tracked_count = 0 THEN 'No tracked software'
    ELSE 'Other'
  END as issue_type
FROM user_data
WHERE email_notifications IS NULL
   OR email_notifications = false
   OR hard_bounce_count >= 3
   OR tracked_count = 0
GROUP BY issue_type
ORDER BY affected_users DESC;
