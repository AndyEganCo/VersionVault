-- =============================================
-- REMOVE CATEGORY CHECK CONSTRAINT
-- =============================================
-- Run this in your Supabase SQL Editor to allow custom categories

-- Remove the check constraint on category
ALTER TABLE public.software DROP CONSTRAINT IF EXISTS valid_category;

-- Add a simple NOT NULL constraint instead (category is still required, but can be any value)
ALTER TABLE public.software ALTER COLUMN category SET NOT NULL;

-- Verify the constraint has been removed
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.software'::regclass
  AND conname = 'valid_category';

-- This should return no rows if successful
