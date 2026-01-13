-- Diagnostic for Andy's emails - using ACTUAL column names

-- 1. Verify the emails exist
SELECT 'USERS FOUND' as check_name,
  id,
  email,
  created_at
FROM auth.users
WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com');

-- 2. Check their settings
SELECT 'USER SETTINGS' as check_name,
  au.email,
  us.email_notifications,
  us.notification_frequency,
  us.timezone,
  us.created_at as settings_created
FROM auth.users au
LEFT JOIN user_settings us ON us.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com');

-- 3. Check for hard bounces in last 30 days (3+ bounces = auto-skip)
SELECT 'EMAIL BOUNCES (30 days)' as check_name,
  au.email,
  COUNT(eb.id) as bounce_count,
  MAX(eb.created_at) as last_bounce
FROM auth.users au
LEFT JOIN email_bounces eb ON eb.user_id = au.id
  AND eb.bounce_type = 'hard'
  AND eb.created_at >= NOW() - INTERVAL '30 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;

-- 4. Check tracked software count
SELECT 'TRACKED SOFTWARE' as check_name,
  au.email,
  COUNT(ts.software_id) as tracked_count
FROM auth.users au
LEFT JOIN tracked_software ts ON ts.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;

-- 5. Check recent queue entries (last 7 days)
SELECT 'RECENT QUEUE ENTRIES' as check_name,
  au.email,
  nq.email_type,
  nq.status,
  nq.scheduled_for,
  nq.sent_at,
  nq.created_at,
  nq.idempotency_key,
  nq.last_error
FROM auth.users au
LEFT JOIN newsletter_queue nq ON nq.user_id = au.id
  AND nq.created_at >= NOW() - INTERVAL '7 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY nq.created_at DESC;

-- 6. Check recent sent emails (last 7 days) - from newsletter_logs
SELECT 'RECENT SENT EMAILS' as check_name,
  au.email,
  nl.email_type,
  nl.status,
  nl.created_at,
  nl.opened_at,
  nl.bounced_at
FROM auth.users au
LEFT JOIN newsletter_logs nl ON nl.user_id = au.id
  AND nl.created_at >= NOW() - INTERVAL '7 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY nl.created_at DESC;

-- 7. Check if there are ANY queue entries for these users (all time)
SELECT 'ALL TIME QUEUE COUNT' as check_name,
  au.email,
  COUNT(nq.id) as total_queue_entries
FROM auth.users au
LEFT JOIN newsletter_queue nq ON nq.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;

-- 8. Check if there are ANY sent emails for these users (all time)
SELECT 'ALL TIME SENT COUNT' as check_name,
  au.email,
  COUNT(nl.id) as total_sent_emails
FROM auth.users au
LEFT JOIN newsletter_logs nl ON nl.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;
