/*
  # Fix Admin Profiles Policy

  1. Changes
    - Drop the previous admin policy
    - Create new policy using app_metadata role directly
  
  2. Security
    - Admins (identified by role in app_metadata) can view all profiles
    - Regular users can still only view their own profile
*/

-- Drop the previous policy
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON profiles;

-- Create policy for admins to view all profiles using app_metadata
CREATE POLICY "admins_can_view_all_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );
