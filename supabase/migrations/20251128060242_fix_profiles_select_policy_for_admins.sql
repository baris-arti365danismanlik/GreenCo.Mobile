/*
  # Fix profiles SELECT policy for admin users

  1. Changes
    - Drop existing restrictive SELECT policy
    - Add new SELECT policy allowing users to view their own profile
    - Add new SELECT policy allowing admin/operations/project_manager users to view all profiles

  2. Security
    - Users can still only see their own profile by default
    - Admin, operations, and project_manager roles can see all profiles
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admin, operations, and project_manager to view all profiles
CREATE POLICY "Managers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations', 'project_manager')
    )
  );
