-- Add missing software entries
INSERT INTO software (id, name, category, manufacturer, website, current_version, last_checked)
VALUES
  -- Show Control & Playback
  ('unreal', 'Unreal Engine', 'Show Control', 'Epic Games', 'https://www.unrealengine.com/', '5.3', now()),
  ('ndi-tools', 'NDI Tools', 'Video Production', 'NDI', 'https://ndi.video/', '5.6.0', now()),

  -- Audio
  ('array-calc', 'ArrayCalc', 'Audio Production', 'd&b audiotechnik', 'https://www.dbaudio.com/global/en/products/software/arraycalc/', '10.20.0', now()),

  -- Network & Control
  ('wireshark', 'Wireshark', 'Network & Control', 'Wireshark Foundation', 'https://www.wireshark.org/', '4.2.3', now()),

  -- Project Management
  ('smartsheet', 'Smartsheet', 'Project Management', 'Smartsheet Inc.', 'https://www.smartsheet.com/', '2024.1', now()),
  ('ms-project', 'Microsoft Project', 'Project Management', 'Microsoft', 'https://www.microsoft.com/microsoft-365/project/project-management-software', '2024', now())

ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  manufacturer = EXCLUDED.manufacturer,
  website = EXCLUDED.website,
  current_version = EXCLUDED.current_version,
  last_checked = EXCLUDED.last_checked;

-- Update any outdated categories
UPDATE software 
SET category = 'Show Control'
WHERE category = 'Control';

UPDATE software
SET category = 'Video Production'
WHERE category = 'Video';

UPDATE software
SET category = 'Audio Production'
WHERE category = 'Audio';