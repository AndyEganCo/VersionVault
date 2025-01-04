/*
  # Create tracked software table

  1. New Tables
    - `tracked_software`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `software_id` (text, references software list)
      - `created_at` (timestamp)
      - Unique constraint on user_id + software_id

  2. Security
    - Enable RLS on `tracked_software` table
    - Add policies for authenticated users to:
      - Read their own tracked software
      - Insert new tracked software
      - Delete their tracked software entries
*/

CREATE TABLE tracked_software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  software_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, software_id)
);

ALTER TABLE tracked_software ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tracked software
CREATE POLICY "Users can read own tracked software"
  ON tracked_software
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to track new software
CREATE POLICY "Users can track software"
  ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to untrack software
CREATE POLICY "Users can untrack software"
  ON tracked_software
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);