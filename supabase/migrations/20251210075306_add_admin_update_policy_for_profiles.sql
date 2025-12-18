/*
  # Add Admin UPDATE Policy for Profiles Table

  ## Changes
  - Add UPDATE policy for admin role on profiles table
  - Admins can update all user profiles

  ## Security
  - Only users with admin role (from JWT metadata) can update profiles
  - This allows the admin panel to successfully update user information

  ## Notes
  - Previously, only technical companies could update their own profile
  - Admin update functionality was blocked due to missing RLS policy
*/

-- Allow admins to update all profiles
CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
