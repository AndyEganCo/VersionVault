-- Fix vMix forum navigation issue by adding auto-scroll interactive scraping
-- Issue: The forum posts newest content at the bottom with lazy loading
-- Solution: Use Puppeteer to auto-scroll until all content is loaded
-- Note: This is a single-topic changelog thread, not a forum index, so we use 'webpage' source_type

DO $$
BEGIN
  -- Try to update existing vMix entry
  UPDATE software
  SET
    version_website = 'https://forums.vmix.com/posts/t33735-vMix-29-Changelog',
    source_type = 'webpage',  -- Single thread, parse as webpage not forum index
    forum_config = NULL,  -- Not needed for single-thread webpage
    scraping_strategy = jsonb_build_object(
      'waitForSelector', '.post, .content, .postbody',
      'waitTime', 3000,
      'customScript', $script$
console.log('🔄 Starting auto-scroll to load all posts...');
let lastHeight = await page.evaluate(() => document.body.scrollHeight);
let scrollAttempts = 0;
const maxScrolls = 20;

while (scrollAttempts < maxScrolls) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  let newHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log('Scroll ' + (scrollAttempts + 1) + ': height ' + lastHeight + ' -> ' + newHeight);

  if (newHeight === lastHeight) {
    console.log('✅ Reached bottom, no more content loading');
    break;
  }

  lastHeight = newHeight;
  scrollAttempts++;
}

console.log('✅ Auto-scroll complete after ' + scrollAttempts + ' scrolls');
$script$
    ),
    updated_at = NOW()
  WHERE name ILIKE '%vmix%';

  -- If no rows updated, vMix doesn't exist yet - inform user
  IF NOT FOUND THEN
    RAISE NOTICE 'vMix not found in database. You may need to add it first.';
  ELSE
    RAISE NOTICE 'vMix updated successfully with auto-scroll interactive scraping strategy';
  END IF;
END $$;

-- Verify the entry
SELECT
  id,
  name,
  manufacturer,
  category,
  version_website,
  source_type,
  forum_config,
  scraping_strategy,
  last_checked
FROM software
WHERE name ILIKE '%vmix%';
