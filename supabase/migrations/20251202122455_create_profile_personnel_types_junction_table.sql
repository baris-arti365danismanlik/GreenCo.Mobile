/*
  # Create junction table for multiple personnel types per profile

  1. New Tables
    - `profile_personnel_types`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `personnel_type_id` (uuid, foreign key to personnel_types)
      - `created_at` (timestamp)
      - Unique constraint on (profile_id, personnel_type_id)

  2. Changes
    - Remove `personnel_type_id` column from profiles table (if exists)
    - This allows many-to-many relationship between profiles and personnel types

  3. Security
    - Enable RLS on `profile_personnel_types` table
    - Add policy for users to view their own personnel types
    - Add policy for admins to view all personnel types
    - Add policy for admins to manage personnel types

  4. Notes
    - A profile can have multiple personnel types (e.g., both cleaning and hospitality)
    - Personnel types can be assigned to multiple profiles
*/

-- Create junction table
CREATE TABLE IF NOT EXISTS profile_personnel_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  personnel_type_id uuid NOT NULL REFERENCES personnel_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, personnel_type_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_personnel_types_profile_id 
ON profile_personnel_types(profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_personnel_types_personnel_type_id 
ON profile_personnel_types(personnel_type_id);

-- Enable RLS
ALTER TABLE profile_personnel_types ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own personnel types
CREATE POLICY "Users can view own personnel types"
  ON profile_personnel_types
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Policy: Admins can view all personnel types
CREATE POLICY "Admins can view all personnel types"
  ON profile_personnel_types
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Policy: Admins can insert personnel types
CREATE POLICY "Admins can insert personnel types"
  ON profile_personnel_types
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Policy: Admins can update personnel types
CREATE POLICY "Admins can update personnel types"
  ON profile_personnel_types
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Policy: Admins can delete personnel types
CREATE POLICY "Admins can delete personnel types"
  ON profile_personnel_types
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');