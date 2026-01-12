-- Simple diagnostic for Andy's emails not being queued

-- First, verify the emails exist
SELECT 'USERS FOUND' as check_name,
  id,
  email,
  created_at
FROM auth.users
WHERE LOWER(email) IN ('andy@andyegan.co', 'theandyegan@gmail.com');

-- Check their settings
SELECT 'USER SETTINGS' as check_name,
  au.email,
  us.email_notifications,
  us.notification_frequency,
  us.timezone,
  us.created_at as settings_created
FROM auth.users au
LEFT JOIN user_settings us ON us.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com');

-- Check for hard bounces in last 30 days
SELECT 'EMAIL BOUNCES (30 days)' as check_name,
  au.email,
  COUNT(eb.id) as bounce_count
FROM auth.users au
LEFT JOIN email_bounces eb ON eb.user_id = au.id
  AND eb.bounce_type = 'hard'
  AND eb.created_at >= NOW() - INTERVAL '30 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;

-- Check tracked software count
SELECT 'TRACKED SOFTWARE' as check_name,
  au.email,
  COUNT(ts.software_id) as tracked_count
FROM auth.users au
LEFT JOIN tracked_software ts ON ts.user_id = au.id
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
GROUP BY au.email;

-- Check recent queue entries (last 7 days)
SELECT 'RECENT QUEUE ENTRIES' as check_name,
  au.email,
  nq.email_type,
  nq.status,
  nq.scheduled_for,
  nq.created_at,
  nq.idempotency_key
FROM auth.users au
LEFT JOIN newsletter_queue nq ON nq.user_id = au.id
  AND nq.created_at >= NOW() - INTERVAL '7 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY nq.created_at DESC;

-- Check recent sent emails (last 7 days)
SELECT 'RECENT SENT EMAILS' as check_name,
  au.email,
  nl.email_type,
  nl.sent_at
FROM auth.users au
LEFT JOIN newsletter_logs nl ON nl.user_id = au.id
  AND nl.created_at >= NOW() - INTERVAL '7 days'
WHERE LOWER(au.email) IN ('andy@andyegan.co', 'theandyegan@gmail.com')
ORDER BY nl.sent_at DESC;
