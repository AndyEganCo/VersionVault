-- Drop existing table if exists
DROP TABLE IF EXISTS software CASCADE;

-- Create software table
CREATE TABLE software (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  manufacturer text NOT NULL,
  website text NOT NULL,
  current_version text,
  last_checked timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (
    category IN (
      'Presentation & Playback',
      'Video Production',
      'Audio Production',
      'Lighting Control',
      'Show Control',
      'Design & Planning',
      'Network & Control',
      'Project Management'
    )
  )
);

-- Enable RLS
ALTER TABLE software ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can read software"
  ON software
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify software"
  ON software
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create updated_at trigger
CREATE TRIGGER update_software_updated_at
  BEFORE UPDATE ON software
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial software data
INSERT INTO software (id, name, category, manufacturer, website, current_version, last_checked)
VALUES 
  -- Show Control & Playback
  ('propresenter', 'ProPresenter', 'Presentation & Playback', 'Renewed Vision', 'https://renewedvision.com/propresenter/', '7.13', now()),
  ('resolume', 'Resolume Arena', 'Video Production', 'Resolume', 'https://resolume.com/', '7.17.0', now()),
  ('touchdesigner', 'TouchDesigner', 'Show Control', 'Derivative', 'https://derivative.ca/', '2023.11340', now()),
  ('watchout', 'Watchout', 'Presentation & Playback', 'Dataton', 'https://www.dataton.com/products/watchout', '6.7.0', now()),
  ('qlab', 'QLab', 'Show Control', 'Figure 53', 'https://qlab.app/', '5.2.3', now()),
  ('hippotizer', 'Hippotizer', 'Video Production', 'Green Hippo', 'https://www.green-hippo.com/', '4.7.1', now()),
  ('disguise', 'disguise', 'Show Control', 'disguise', 'https://www.disguise.one/', 'r23.3', now()),
  ('pvp', 'PVP', 'Video Production', 'Renewed Vision', 'https://renewedvision.com/pvp/', '3.5', now()),

  -- Audio
  ('qsys', 'Q-SYS Designer', 'Audio Production', 'QSC', 'https://www.qsc.com/solutions-products/q-sys/', '9.5.0', now()),
  ('dante-controller', 'Dante Controller', 'Audio Production', 'Audinate', 'https://www.audinate.com/products/software/dante-controller', '4.7.0.6', now()),
  ('cl-editor', 'CL Editor', 'Audio Production', 'Yamaha', 'https://usa.yamaha.com/products/proaudio/software/', 'V5.1.0', now()),
  ('waves-multirack', 'Waves MultiRack', 'Audio Production', 'Waves', 'https://www.waves.com/mixers-racks/multirack', '11.1', now()),
  ('smaart', 'Smaart', 'Audio Production', 'Rational Acoustics', 'https://www.rationalacoustics.com/', 'v9', now()),
  ('lake-controller', 'Lake Controller', 'Audio Production', 'Lab.gruppen', 'https://www.labgruppen.com/software', '6.5.1', now()),
  ('biamp', 'Biamp Canvas', 'Audio Production', 'Biamp', 'https://www.biamp.com/software', '7.2.1', now()),

  -- Lighting
  ('capture', 'Capture', 'Lighting Control', 'Capture Sweden AB', 'https://www.capture.se/', '2024.1', now()),
  ('ma3d', 'MA 3D', 'Lighting Control', 'MA Lighting', 'https://www.malighting.com/downloads/products/grandma3/', '1.9.3.3', now()),
  ('wysiwyg', 'WYSIWYG', 'Lighting Control', 'CAST Software', 'https://cast-soft.com/wysiwyg-lighting-design/', 'R49', now()),
  ('depence2', 'Depence²', 'Lighting Control', 'SYNCRONORM', 'https://www.syncronorm.com/products/depence2/', '2.1.0', now()),
  ('madrix', 'MADRIX', 'Lighting Control', 'MADRIX', 'https://www.madrix.com/', '5.5', now()),
  ('luminex', 'Luminex LumiNet Monitor', 'Lighting Control', 'Luminex', 'https://www.luminex.be/products/software/', '2.4.3', now()),

  -- Design & Planning
  ('vectorworks', 'Vectorworks Spotlight', 'Design & Planning', 'Vectorworks, Inc.', 'https://www.vectorworks.net/spotlight', '2024 SP3', now()),
  ('autocad', 'AutoCAD', 'Design & Planning', 'Autodesk', 'https://www.autodesk.com/products/autocad/overview', '2024.1', now()),
  ('sketchup', 'SketchUp Pro', 'Design & Planning', 'Trimble', 'https://www.sketchup.com/', '2024.0', now()),
  ('soundvision', 'Soundvision', 'Design & Planning', 'L-Acoustics', 'https://www.l-acoustics.com/products/soundvision/', '5.6.1', now()),
  ('ease', 'EASE', 'Design & Planning', 'AFMG', 'https://ease.afmg.eu/', '4.4.70', now()),
  ('mapp3d', 'MAPP 3D', 'Design & Planning', 'Meyer Sound', 'https://meyersound.com/product/mapp-3d/', '1.4.0', now()),

  -- Network & Control
  ('riedel-control', 'Riedel Control Panel', 'Network & Control', 'Riedel', 'https://www.riedel.net/en/products/intercom/', '2.10.0', now()),
  ('clearcom-concert', 'ClearCom Concert', 'Network & Control', 'Clear-Com', 'https://www.clearcom.com/concert-intercom-software/', '6.1.2', now()),
  ('dante-domain', 'Dante Domain Manager', 'Network & Control', 'Audinate', 'https://www.audinate.com/products/software/dante-domain-manager', '1.4.2', now()),
  ('pathfinder', 'Pathfinder', 'Network & Control', 'Telos Alliance', 'https://www.telosalliance.com/Axia/Pathfinder', '2.1.0', now()),

  -- Project Management
  ('projectworks', 'ProjectWorks', 'Project Management', 'ProjectWorks', 'https://www.projectworks.com/', '2024.1', now()),
  ('intellievent', 'IntelliEvent', 'Project Management', 'IntelliEvent', 'https://intellievent.com/', '7.2.1', now()),
  ('crewcaller', 'CrewCaller', 'Project Management', 'CrewCaller', 'https://crewcaller.com/', '3.5.0', now())
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  manufacturer = EXCLUDED.manufacturer,
  website = EXCLUDED.website,
  current_version = EXCLUDED.current_version,
  last_checked = EXCLUDED.last_checked;