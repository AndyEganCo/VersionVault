-- Fix RLS on scraping_patterns table
-- Security Issue: RLS was not enabled, allowing unrestricted public access
-- This migration enables RLS and adds appropriate policies

-- Enable Row Level Security
ALTER TABLE scraping_patterns ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role has full access (needed for cron jobs and automated scraping)
CREATE POLICY "Service role can manage scraping patterns" ON scraping_patterns
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 2: Admins can view all scraping patterns
CREATE POLICY "Admins can view scraping patterns" ON scraping_patterns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Policy 3: Admins can insert scraping patterns
CREATE POLICY "Admins can insert scraping patterns" ON scraping_patterns
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Policy 4: Admins can update scraping patterns
CREATE POLICY "Admins can update scraping patterns" ON scraping_patterns
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Policy 5: Admins can delete scraping patterns
CREATE POLICY "Admins can delete scraping patterns" ON scraping_patterns
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'scraping_patterns') THEN
    RAISE EXCEPTION 'RLS was not enabled on scraping_patterns table';
  END IF;
  RAISE NOTICE 'RLS successfully enabled on scraping_patterns table';
END $$;
