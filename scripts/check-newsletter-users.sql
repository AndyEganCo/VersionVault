-- Query to check all users and their newsletter digest settings
-- This will show who isn't getting newsletter digests and why

-- First, let's get all users with their settings
WITH user_data AS (
  SELECT
    au.id as user_id,
    au.email,
    au.created_at as user_created_at,
    us.email_notifications,
    us.notification_frequency,
    us.timezone,
    us.created_at as settings_created_at,
    -- Count tracked software
    (SELECT COUNT(*)
     FROM tracked_software ts
     WHERE ts.user_id = au.id) as tracked_software_count,
    -- Check for bounces
    (SELECT COUNT(*)
     FROM email_bounces eb
     WHERE eb.user_id = au.id
     AND eb.bounce_type = 'hard'
     AND eb.created_at >= NOW() - INTERVAL '30 days') as recent_hard_bounces
  FROM auth.users au
  LEFT JOIN user_settings us ON us.user_id = au.id
  WHERE au.email IS NOT NULL
  ORDER BY au.email
)

-- Now display the results with status
SELECT
  email,
  CASE
    WHEN email_notifications IS NULL THEN '❌ NO SETTINGS RECORD'
    WHEN email_notifications = false THEN '🔕 NOTIFICATIONS DISABLED'
    WHEN notification_frequency = 'monthly' THEN '📅 MONTHLY DIGEST'
    WHEN tracked_software_count = 0 THEN '⏭️  NO TRACKED SOFTWARE'
    WHEN recent_hard_bounces >= 3 THEN '⚠️  TOO MANY BOUNCES'
    WHEN notification_frequency = 'daily' THEN '✅ DAILY DIGEST'
    WHEN notification_frequency = 'weekly' THEN '✅ WEEKLY DIGEST'
    ELSE '⚠️  UNKNOWN STATUS'
  END as status,
  notification_frequency,
  email_notifications,
  tracked_software_count,
  recent_hard_bounces,
  timezone,
  user_created_at,
  settings_created_at
FROM user_data
ORDER BY
  CASE
    WHEN email_notifications IS NULL THEN 1
    WHEN email_notifications = false THEN 2
    WHEN tracked_software_count = 0 THEN 3
    WHEN recent_hard_bounces >= 3 THEN 4
    ELSE 5
  END,
  email;

-- Summary counts
SELECT
  '📊 SUMMARY' as section,
  COUNT(*) as total_users,
  SUM(CASE WHEN email_notifications IS NULL THEN 1 ELSE 0 END) as no_settings_record,
  SUM(CASE WHEN email_notifications = false THEN 1 ELSE 0 END) as notifications_disabled,
  SUM(CASE WHEN email_notifications = true AND notification_frequency = 'daily' THEN 1 ELSE 0 END) as daily_digest,
  SUM(CASE WHEN email_notifications = true AND notification_frequency = 'weekly' THEN 1 ELSE 0 END) as weekly_digest,
  SUM(CASE WHEN email_notifications = true AND notification_frequency = 'monthly' THEN 1 ELSE 0 END) as monthly_digest,
  SUM(CASE WHEN email_notifications = true AND tracked_software_count = 0 THEN 1 ELSE 0 END) as no_tracked_software,
  SUM(CASE WHEN recent_hard_bounces >= 3 THEN 1 ELSE 0 END) as too_many_bounces
FROM (
  SELECT
    au.id as user_id,
    au.email,
    us.email_notifications,
    us.notification_frequency,
    (SELECT COUNT(*) FROM tracked_software ts WHERE ts.user_id = au.id) as tracked_software_count,
    (SELECT COUNT(*) FROM email_bounces eb WHERE eb.user_id = au.id AND eb.bounce_type = 'hard' AND eb.created_at >= NOW() - INTERVAL '30 days') as recent_hard_bounces
  FROM auth.users au
  LEFT JOIN user_settings us ON us.user_id = au.id
  WHERE au.email IS NOT NULL
) summary_data;

-- Show specific users mentioned (Andy's emails)
SELECT
  '🔍 CHECKING SPECIFIC USERS' as section,
  email,
  CASE
    WHEN email_notifications IS NULL THEN '❌ NO SETTINGS RECORD'
    WHEN email_notifications = false THEN '🔕 NOTIFICATIONS DISABLED'
    WHEN notification_frequency = 'monthly' THEN '📅 MONTHLY DIGEST'
    WHEN tracked_software_count = 0 THEN '⏭️  NO TRACKED SOFTWARE'
    WHEN recent_hard_bounces >= 3 THEN '⚠️  TOO MANY BOUNCES'
    WHEN notification_frequency = 'daily' THEN '✅ DAILY DIGEST'
    WHEN notification_frequency = 'weekly' THEN '✅ WEEKLY DIGEST'
    ELSE '⚠️  UNKNOWN STATUS'
  END as status,
  notification_frequency,
  email_notifications,
  tracked_software_count,
  recent_hard_bounces
FROM (
  SELECT
    au.email,
    us.email_notifications,
    us.notification_frequency,
    (SELECT COUNT(*) FROM tracked_software ts WHERE ts.user_id = au.id) as tracked_software_count,
    (SELECT COUNT(*) FROM email_bounces eb WHERE eb.user_id = au.id AND eb.bounce_type = 'hard' AND eb.created_at >= NOW() - INTERVAL '30 days') as recent_hard_bounces
  FROM auth.users au
  LEFT JOIN user_settings us ON us.user_id = au.id
  WHERE au.email IN ('Andy@andyegan.co', 'theandyegan@gmail.com', 'andy@andyegan.co')
) specific_users;
