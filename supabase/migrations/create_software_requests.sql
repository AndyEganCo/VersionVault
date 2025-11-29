-- Create software_requests table for user-submitted software tracking requests
CREATE TABLE IF NOT EXISTS software_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  "versionUrl" TEXT NOT NULL,
  description TEXT,
  "userId" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE software_requests ENABLE ROW LEVEL SECURITY;

-- Policies for software_requests

-- Users can create requests (authenticated users only)
DROP POLICY IF EXISTS "Users can create software requests" ON software_requests;
CREATE POLICY "Users can create software requests"
ON software_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "userId");

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own requests" ON software_requests;
CREATE POLICY "Users can view own requests"
ON software_requests
FOR SELECT
TO authenticated
USING (auth.uid() = "userId");

-- Admins can view all requests
DROP POLICY IF EXISTS "Admins can view all requests" ON software_requests;
CREATE POLICY "Admins can view all requests"
ON software_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Admins can update request status
DROP POLICY IF EXISTS "Admins can update requests" ON software_requests;
CREATE POLICY "Admins can update requests"
ON software_requests
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
)
WITH CHECK (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Admins can delete requests
DROP POLICY IF EXISTS "Admins can delete requests" ON software_requests;
CREATE POLICY "Admins can delete requests"
ON software_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_software_requests_status ON software_requests(status);
CREATE INDEX IF NOT EXISTS idx_software_requests_user ON software_requests("userId");
CREATE INDEX IF NOT EXISTS idx_software_requests_created ON software_requests("createdAt" DESC);

-- Add comment
COMMENT ON TABLE software_requests IS 'User-submitted requests for new software to be tracked';
