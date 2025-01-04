/*
  # Update Crawler Status Table

  1. Changes
    - Remove Crawler4AI entry
    - Update Puppeteer entry
*/

-- Remove Crawler4AI entry
DELETE FROM crawler_status WHERE name = 'Crawler4AI';

-- Update Puppeteer entry
UPDATE crawler_status 
SET status = 'idle', 
    success_rate = 0, 
    error = NULL 
WHERE name = 'Puppeteer';