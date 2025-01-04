/*
  # Admin Version Check System

  1. Changes
    - Add admin policy function
    - Add admin-specific RLS policies
    - Add materialized view for version check stats
  
  2. Security
    - Only admins can access all version checks
    - Regular users can only see their own checks
*/

-- Create admin policy function
CREATE OR REPLACE FUNCTION is_admin(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email = 'andy@andyegan.co';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin policy to version_checks
CREATE POLICY "Admins can read all version checks"
  ON version_checks
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.jwt() ->> 'email') OR
    auth.uid() = user_id
  );

-- Create materialized view for version check stats
CREATE MATERIALIZED VIEW IF NOT EXISTS version_check_stats AS
SELECT
  date_trunc('hour', checked_at) as time_bucket,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE status = 'success') as successful_checks,
  COUNT(*) FILTER (WHERE status = 'error') as failed_checks,
  COUNT(*) FILTER (WHERE detected_version != current_version) as new_versions
FROM version_checks
GROUP BY time_bucket;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_version_check_stats_time_bucket 
ON version_check_stats(time_bucket DESC);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_version_check_stats()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY version_check_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stats refresh
DROP TRIGGER IF EXISTS refresh_version_check_stats_trigger ON version_checks;
CREATE TRIGGER refresh_version_check_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON version_checks
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_version_check_stats();

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW version_check_stats;