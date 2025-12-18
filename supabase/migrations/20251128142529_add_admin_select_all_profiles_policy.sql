/*
  # Add Admin SELECT Policy for Profiles

  1. Changes
    - Add new policy allowing admins to view all profiles
    - Admins are identified by their role in auth.jwt() metadata
  
  2. Security
    - Only users with role='admin' in JWT can view all profiles
    - Regular users can still only view their own profile
*/

-- Create policy for admins to view all profiles
CREATE POLICY "admins_can_view_all_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_role')::text = 'admin'
  );
