/*
  # Fix Profiles RLS - Simplify Admin Access
  
  This migration simplifies the RLS policy for admins to view all profiles.
  
  ## Changes
  - Drop the existing complex SELECT policy
  - Create a new simpler policy that checks app_metadata directly
  
  ## Security
  - Admins can view all profiles
  - Non-admins can only view their own profile
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can view all profiles, users can view own profile" ON profiles;

-- Create new simplified policy
CREATE POLICY "Users can view profiles based on role"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    auth.uid() = id
    OR
    -- OR user is an admin (check JWT directly)
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
