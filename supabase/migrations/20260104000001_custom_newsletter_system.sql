-- Custom Newsletter System
-- Allows admins to compose and send custom newsletters

-- Newsletter Drafts Table
CREATE TABLE IF NOT EXISTS newsletter_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Email content
  subject TEXT NOT NULL,
  content TEXT NOT NULL, -- HTML or markdown content
  content_type TEXT NOT NULL DEFAULT 'html' CHECK (content_type IN ('html', 'markdown')),

  -- Metadata
  name TEXT, -- Optional name for the draft (e.g., "January Product Update")
  notes TEXT, -- Admin notes about the newsletter

  -- Status
  is_template BOOLEAN DEFAULT false, -- If true, can be reused as a template

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ -- Null if draft, set when sent
);

-- Custom Newsletter Sends Table (log of custom newsletters sent)
CREATE TABLE IF NOT EXISTS newsletter_custom_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES newsletter_drafts(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,

  -- Email content (snapshot at send time)
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,

  -- Recipients
  recipient_count INTEGER NOT NULL,
  recipient_filter JSONB, -- Store the filter used (e.g., {"type": "all"} or {"type": "segment", "criteria": {...}})

  -- Stats
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE newsletter_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_custom_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for newsletter_drafts
-- Only admins can view/edit drafts
CREATE POLICY "Admins can view all drafts"
  ON newsletter_drafts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create drafts"
  ON newsletter_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update drafts"
  ON newsletter_drafts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete drafts"
  ON newsletter_drafts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS Policies for newsletter_custom_sends
-- Only admins can view send logs
CREATE POLICY "Admins can view all custom sends"
  ON newsletter_custom_sends
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create send records"
  ON newsletter_custom_sends
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update send records"
  ON newsletter_custom_sends
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_newsletter_drafts_created_by ON newsletter_drafts(created_by);
CREATE INDEX idx_newsletter_drafts_is_template ON newsletter_drafts(is_template);
CREATE INDEX idx_newsletter_drafts_created_at ON newsletter_drafts(created_at DESC);
CREATE INDEX idx_newsletter_custom_sends_sent_by ON newsletter_custom_sends(sent_by);
CREATE INDEX idx_newsletter_custom_sends_created_at ON newsletter_custom_sends(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_newsletter_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_newsletter_draft_timestamp
  BEFORE UPDATE ON newsletter_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_draft_updated_at();
