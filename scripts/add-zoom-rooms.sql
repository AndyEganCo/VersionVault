-- Add or update Zoom Rooms with interactive scraping strategy

-- First, check if Zoom Rooms exists
DO $$
BEGIN
  -- Try to update existing entry
  UPDATE software
  SET
    version_website = 'https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms',
    source_type = 'webpage',
    scraping_strategy = '{
      "waitForSelector": "article, .article-body, .kb-article-content, [role=\"article\"]",
      "waitTime": 5000
    }'::jsonb,
    updated_at = NOW()
  WHERE name = 'Zoom Rooms';

  -- If no rows updated, insert new entry
  IF NOT FOUND THEN
    INSERT INTO software (
      name,
      manufacturer,
      category,
      version_website,
      source_type,
      scraping_strategy,
      description
    ) VALUES (
      'Zoom Rooms',
      'Zoom Video Communications',
      'Presentation & Playback',  -- Or 'Video Conferencing' if that's more appropriate
      'https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms',
      'webpage',
      '{
        "waitForSelector": "article, .article-body, .kb-article-content, [role=\"article\"]",
        "waitTime": 5000
      }'::jsonb,
      'Video conferencing system for meeting rooms and conference spaces'
    );
  END IF;

  RAISE NOTICE 'Zoom Rooms updated/inserted successfully with interactive scraping strategy';
END $$;

-- Verify the entry
SELECT
  id,
  name,
  manufacturer,
  category,
  version_website,
  source_type,
  scraping_strategy,
  current_version,
  last_checked
FROM software
WHERE name = 'Zoom Rooms';
