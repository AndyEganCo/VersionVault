/*
  # Version tracking system

  1. New Tables
    - `software_versions`
      - `id` (uuid, primary key)
      - `software_id` (text, references software)
      - `version` (text)
      - `detected_at` (timestamptz)
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `software_id` (text)
      - `message` (text)
      - `type` (text)
      - `created_at` (timestamptz)
      - `read_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

CREATE TABLE software_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id text NOT NULL,
  version text NOT NULL,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  software_id text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Enable RLS
ALTER TABLE software_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies for software_versions
CREATE POLICY "Anyone can read software versions"
  ON software_versions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);