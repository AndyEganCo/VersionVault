-- Create table to track ChatGPT version audit flags
CREATE TABLE IF NOT EXISTS version_audit_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id UUID NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  audit_run_id UUID NOT NULL,
  current_version TEXT NOT NULL,
  suggested_version TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  chatgpt_reasoning TEXT,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  verification_result TEXT CHECK (verification_result IN ('confirmed', 'false_positive', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to track audit runs
CREATE TABLE IF NOT EXISTS version_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_software_checked INTEGER NOT NULL,
  flags_created INTEGER NOT NULL DEFAULT 0,
  chatgpt_model TEXT NOT NULL,
  execution_time_ms INTEGER,
  admin_notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_version_audit_flags_software_id ON version_audit_flags(software_id);
CREATE INDEX IF NOT EXISTS idx_version_audit_flags_audit_run_id ON version_audit_flags(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_version_audit_flags_resolved_at ON version_audit_flags(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_version_audit_flags_flagged_at ON version_audit_flags(flagged_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_audit_runs_created_at ON version_audit_runs(created_at DESC);

-- Enable RLS
ALTER TABLE version_audit_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_audit_runs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view audit flags"
  ON version_audit_flags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update audit flags"
  ON version_audit_flags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view audit runs"
  ON version_audit_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage audit flags"
  ON version_audit_flags FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage audit runs"
  ON version_audit_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get unresolved audit flags for prioritization
CREATE OR REPLACE FUNCTION get_audit_flagged_software_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(DISTINCT software_id)
  FROM version_audit_flags
  WHERE resolved_at IS NULL
    AND verification_result = 'pending'
    AND flagged_at > NOW() - INTERVAL '7 days';
$$ LANGUAGE sql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_audit_flagged_software_ids() TO service_role;

COMMENT ON TABLE version_audit_flags IS 'Tracks software flagged as potentially outdated by ChatGPT audit';
COMMENT ON TABLE version_audit_runs IS 'Tracks execution history of ChatGPT version audits';
COMMENT ON FUNCTION get_audit_flagged_software_ids() IS 'Returns array of software IDs with unresolved audit flags from last 7 days';
