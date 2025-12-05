-- Version Approval System for Newsletter
-- Admins approve versions before they're included in digests

-- ============================================
-- 1. Add approval column to version_history
-- ============================================
ALTER TABLE version_history
  ADD COLUMN IF NOT EXISTS newsletter_approved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Index for finding unapproved versions
CREATE INDEX IF NOT EXISTS idx_version_history_unapproved
  ON version_history(newsletter_approved, detected_at DESC)
  WHERE newsletter_approved = false;

-- ============================================
-- 2. RLS policies for approval (admins only)
-- ============================================

-- Drop existing update policies if they exist
DROP POLICY IF EXISTS "Admins can update version approval" ON version_history;

-- Allow admins to update approval status
CREATE POLICY "Admins can update version approval" ON version_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
