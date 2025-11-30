-- =============================================
-- SOFTWARE REQUESTS TABLE RLS POLICIES
-- =============================================
-- Run this in your Supabase SQL Editor

-- Enable RLS on software_requests table
ALTER TABLE public.software_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own requests" ON public.software_requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON public.software_requests;
DROP POLICY IF EXISTS "Users can insert requests" ON public.software_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.software_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON public.software_requests;
DROP POLICY IF EXISTS "Admins can delete any request" ON public.software_requests;

-- Allow users to read their own requests
CREATE POLICY "Users can read own requests" ON public.software_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to read all requests
CREATE POLICY "Admins can read all requests" ON public.software_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Allow authenticated users to insert their own requests
CREATE POLICY "Users can insert requests" ON public.software_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow admins to update request status
CREATE POLICY "Admins can update requests" ON public.software_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Allow users to delete their own requests
CREATE POLICY "Users can delete own requests" ON public.software_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to delete any request
CREATE POLICY "Admins can delete any request" ON public.software_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Verify policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'software_requests';
