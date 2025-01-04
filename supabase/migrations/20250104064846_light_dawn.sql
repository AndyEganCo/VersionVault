-- Create function to safely track software
CREATE OR REPLACE FUNCTION track_software(p_user_id uuid, p_software_id text)
RETURNS void AS $$
BEGIN
  INSERT INTO tracked_software (user_id, software_id)
  VALUES (p_user_id, p_software_id)
  ON CONFLICT (user_id, software_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely track multiple software
CREATE OR REPLACE FUNCTION track_all_software(p_user_id uuid, p_software_ids text[])
RETURNS void AS $$
BEGIN
  INSERT INTO tracked_software (user_id, software_id)
  SELECT p_user_id, software_id
  FROM unnest(p_software_ids) AS software_id
  ON CONFLICT (user_id, software_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for functions
CREATE POLICY "Users can execute track_software"
  ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can execute track_all_software"
  ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);