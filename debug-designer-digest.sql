-- Debug script to investigate why Designer isn't showing in digests
-- Run this in your Supabase SQL Editor

-- 1. Check the software record
SELECT
  'Software Record' as section,
  s.id,
  s.name,
  s.manufacturer,
  s.current_version,
  s.release_date,
  s.last_checked
FROM software s
WHERE s.name ILIKE '%designer%' OR s.manufacturer ILIKE '%disguise%';

-- 2. Check version history for Designer
SELECT
  'Version History' as section,
  vh.id,
  vh.version,
  vh.release_date,
  vh.detected_at,
  vh.newsletter_verified,
  vh.verified_at,
  vh.type,
  vh.notes
FROM software_version_history vh
JOIN software s ON vh.software_id = s.id
WHERE s.name ILIKE '%designer%' OR s.manufacturer ILIKE '%disguise%'
ORDER BY vh.release_date DESC NULLS LAST, vh.detected_at DESC
LIMIT 10;

-- 3. Check what date range the weekly digest would use
SELECT
  'Digest Time Window' as section,
  NOW() as current_time,
  NOW() - INTERVAL '7 days' as weekly_cutoff,
  NOW() - INTERVAL '30 days' as monthly_cutoff;

-- 4. Check if Designer version falls within the weekly window
SELECT
  'Versions in Weekly Window' as section,
  s.name,
  s.manufacturer,
  vh.version,
  vh.release_date,
  vh.detected_at,
  vh.newsletter_verified,
  CASE
    WHEN vh.release_date >= NOW() - INTERVAL '7 days' THEN 'Within weekly window'
    WHEN vh.detected_at >= NOW() - INTERVAL '7 days' THEN 'Within weekly window (by detected_at)'
    ELSE 'Outside weekly window'
  END as status
FROM software_version_history vh
JOIN software s ON vh.software_id = s.id
WHERE (s.name ILIKE '%designer%' OR s.manufacturer ILIKE '%disguise%')
  AND vh.newsletter_verified = true
ORDER BY COALESCE(vh.release_date, vh.detected_at) DESC
LIMIT 5;

-- 5. Check user's tracked software
SELECT
  'User Tracking' as section,
  u.email,
  ts.software_id,
  s.name,
  ts.last_notified_version,
  ts.created_at as tracking_since
FROM tracked_software ts
JOIN auth.users u ON ts.user_id = u.id
JOIN software s ON ts.software_id = s.id
WHERE s.name ILIKE '%designer%' OR s.manufacturer ILIKE '%disguise%';

-- 6. Check user notification settings
SELECT
  'User Settings' as section,
  u.email,
  us.email_notifications,
  us.notification_frequency,
  us.timezone
FROM user_settings us
JOIN auth.users u ON us.user_id = u.id
WHERE u.email ILIKE '%andy%' OR u.email ILIKE '%theandyegan%';
