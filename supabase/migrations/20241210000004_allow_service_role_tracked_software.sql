-- Allow service role to access tracked_software for newsletter functions
-- This is needed because the edge functions use service role key
-- and RLS policies block access even for service role

-- Add policy to allow service role full access to tracked_software
CREATE POLICY "Service role can access tracked software"
ON tracked_software
FOR SELECT
TO service_role
USING (true);

-- Add policy to allow service role to update last_notified fields
CREATE POLICY "Service role can update notification status"
ON tracked_software
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
