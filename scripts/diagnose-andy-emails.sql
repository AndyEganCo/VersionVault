-- Diagnostic query to figure out why Andy's emails aren't being queued
-- even though they're configured correctly

-- Check 1: User Settings (we already know these are good)
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '1. USER SETTINGS' as check_name, * FROM (
  SELECT
    au.email,
    us.email_notifications,
    us.notification_frequency,
    us.timezone,
    us.created_at as settings_created,
    us.updated_at as settings_updated
  FROM andy_users au
  LEFT JOIN user_settings us ON us.user_id = au.id
) settings_check;

-- Check 2: Email Bounces (hard bounces in last 30 days)
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '2. EMAIL BOUNCES (last 30 days)' as check_name, * FROM (
  SELECT
    au.email,
    COUNT(eb.id) as hard_bounce_count,
    MAX(eb.created_at) as last_bounce_date,
    STRING_AGG(eb.reason, ' | ') as bounce_reasons
  FROM andy_users au
  LEFT JOIN email_bounces eb ON eb.user_id = au.id
    AND eb.bounce_type = 'hard'
    AND eb.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY au.email
) bounce_check;

-- Check 3: Tracked Software
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '3. TRACKED SOFTWARE' as check_name, * FROM (
  SELECT
    au.email,
    COUNT(ts.software_id) as tracked_count,
    (SELECT STRING_AGG(s2.name, ', ' ORDER BY s2.name)
     FROM (
       SELECT s.name
       FROM tracked_software ts2
       JOIN software s ON s.id = ts2.software_id
       WHERE ts2.user_id = au.id
       ORDER BY s.name
       LIMIT 10
     ) s2
    ) as sample_software
  FROM andy_users au
  LEFT JOIN tracked_software ts ON ts.user_id = au.id
  GROUP BY au.email, au.id
) tracked_check;

-- Check 4: Newsletter Queue (recent entries)
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '4. NEWSLETTER QUEUE (last 7 days)' as check_name, * FROM (
  SELECT
    au.email,
    nq.email_type,
    nq.status,
    nq.scheduled_for,
    nq.created_at,
    nq.sent_at,
    nq.last_error,
    nq.idempotency_key
  FROM andy_users au
  LEFT JOIN newsletter_queue nq ON nq.user_id = au.id
    AND nq.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY nq.created_at DESC
) queue_check;

-- Check 5: Newsletter Logs (recent sends)
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '5. NEWSLETTER LOGS (last 7 days)' as check_name, * FROM (
  SELECT
    au.email,
    nl.email_type,
    nl.sent_at,
    nl.resend_id,
    nl.created_at
  FROM andy_users au
  LEFT JOIN newsletter_logs nl ON nl.user_id = au.id
    AND nl.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY nl.sent_at DESC
) log_check;

-- Check 6: Recent version updates (last 7 days) for tracked software
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '6. RECENT UPDATES FOR TRACKED SOFTWARE (last 7 days)' as check_name, * FROM (
  SELECT
    au.email,
    COUNT(DISTINCT svh.software_id) as software_with_updates,
    COUNT(svh.id) as total_updates,
    (SELECT STRING_AGG(DISTINCT s2.name, ', ')
     FROM (
       SELECT DISTINCT s.name
       FROM tracked_software ts2
       JOIN software s ON s.id = ts2.software_id
       JOIN software_version_history svh2 ON svh2.software_id = ts2.software_id
       WHERE ts2.user_id = au.id
         AND svh2.newsletter_verified = true
         AND (svh2.release_date >= NOW() - INTERVAL '7 days' OR svh2.detected_at >= NOW() - INTERVAL '7 days')
       ORDER BY s.name
       LIMIT 10
     ) s2
    ) as updated_software_sample
  FROM andy_users au
  JOIN tracked_software ts ON ts.user_id = au.id
  JOIN software s ON s.id = ts.software_id
  LEFT JOIN software_version_history svh ON svh.software_id = ts.software_id
    AND svh.newsletter_verified = true
    AND (svh.release_date >= NOW() - INTERVAL '7 days' OR svh.detected_at >= NOW() - INTERVAL '7 days')
  GROUP BY au.email, au.id
) update_check;

-- Check 7: Compare with a working user (find someone who WAS queued)
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '7. COMPARISON WITH WORKING USER' as check_name, * FROM (
  SELECT
    'WORKING USER' as type,
    au.email,
    us.email_notifications,
    us.notification_frequency,
    COUNT(ts.software_id) as tracked_count,
    COUNT(CASE WHEN eb.bounce_type = 'hard' AND eb.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_bounces
  FROM auth.users au
  JOIN user_settings us ON us.user_id = au.id
  LEFT JOIN tracked_software ts ON ts.user_id = au.id
  LEFT JOIN email_bounces eb ON eb.user_id = au.id
  WHERE au.email = 'fraseravops@gmail.com' -- This user appeared in the queue
  GROUP BY au.email, us.email_notifications, us.notification_frequency

  UNION ALL

  SELECT
    'ANDY' as type,
    au.email,
    us.email_notifications,
    us.notification_frequency,
    COUNT(ts.software_id) as tracked_count,
    COUNT(CASE WHEN eb.bounce_type = 'hard' AND eb.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_bounces
  FROM andy_users au
  LEFT JOIN user_settings us ON us.user_id = au.id
  LEFT JOIN tracked_software ts ON ts.user_id = au.id
  LEFT JOIN email_bounces eb ON eb.user_id = au.id
  GROUP BY au.email, us.email_notifications, us.notification_frequency
) comparison;

-- Check 8: Check if user IDs exist in all tables
WITH andy_users AS (
  SELECT id, email
  FROM auth.users
  WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
)
SELECT '8. USER ID EXISTS IN TABLES' as check_name, * FROM (
  SELECT
    au.email,
    au.id as user_id,
    CASE WHEN us.user_id IS NOT NULL THEN '✓' ELSE '✗' END as in_user_settings,
    CASE WHEN ts.user_id IS NOT NULL THEN '✓' ELSE '✗' END as in_tracked_software,
    CASE WHEN rcs.user_id IS NOT NULL THEN '✓' ELSE '✗' END as in_resend_sync
  FROM andy_users au
  LEFT JOIN user_settings us ON us.user_id = au.id
  LEFT JOIN (SELECT DISTINCT user_id FROM tracked_software) ts ON ts.user_id = au.id
  LEFT JOIN resend_contact_sync rcs ON rcs.user_id = au.id
) table_check;
