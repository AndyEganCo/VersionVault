-- Resend Contact Sync Integration
-- Automatically sync new users and updates to Resend

-- ============================================
-- 1. Create sync tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS resend_contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  resend_contact_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resend_sync_status ON resend_contact_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_resend_sync_user ON resend_contact_sync(user_id);

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE resend_contact_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all sync records" ON resend_contact_sync
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage sync records" ON resend_contact_sync
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. Function to mark user for Resend sync
-- ============================================
CREATE OR REPLACE FUNCTION mark_user_for_resend_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update sync record
  INSERT INTO resend_contact_sync (user_id, email, sync_status)
  VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = NEW.email,
    sync_status = 'pending',
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Trigger on auth.users for new signups
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created_sync_resend ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_resend
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION mark_user_for_resend_sync();

-- ============================================
-- 5. Trigger on auth.users for email updates
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_updated_sync_resend ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_resend
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION mark_user_for_resend_sync();

-- ============================================
-- 6. Function to mark for sync when settings change
-- ============================================
CREATE OR REPLACE FUNCTION mark_user_settings_for_resend_sync()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user's email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Mark for sync
  INSERT INTO resend_contact_sync (user_id, email, sync_status)
  VALUES (NEW.user_id, user_email, 'pending')
  ON CONFLICT (user_id)
  DO UPDATE SET
    sync_status = 'pending',
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Trigger on user_settings changes
-- ============================================
DROP TRIGGER IF EXISTS on_user_settings_changed_sync_resend ON user_settings;
CREATE TRIGGER on_user_settings_changed_sync_resend
  AFTER UPDATE ON user_settings
  FOR EACH ROW
  WHEN (
    OLD.email_notifications IS DISTINCT FROM NEW.email_notifications OR
    OLD.notification_frequency IS DISTINCT FROM NEW.notification_frequency
  )
  EXECUTE FUNCTION mark_user_settings_for_resend_sync();

-- ============================================
-- 8. Backfill existing users
-- ============================================
INSERT INTO resend_contact_sync (user_id, email, sync_status)
SELECT id, email, 'pending'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 9. Helper function to get pending sync count
-- ============================================
CREATE OR REPLACE FUNCTION get_pending_resend_sync_count()
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM resend_contact_sync
  WHERE sync_status = 'pending';
$$ LANGUAGE SQL STABLE;

-- ============================================
-- 10. Updated_at Trigger
-- ============================================
DROP TRIGGER IF EXISTS update_resend_contact_sync_updated_at ON resend_contact_sync;
CREATE TRIGGER update_resend_contact_sync_updated_at
  BEFORE UPDATE ON resend_contact_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
