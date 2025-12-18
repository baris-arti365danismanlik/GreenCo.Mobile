/*
  # Fix RLS infinite recursion in profiles table

  1. Problem
    - The "Managers can view all profiles" policy causes infinite recursion
    - When checking if user is admin/manager, it queries profiles table
    - That query triggers the same policy again, causing infinite loop

  2. Solution
    - Use auth.jwt() to check role from JWT token instead of querying profiles
    - This avoids the recursive query issue
    - Role is stored in user metadata during user creation

  3. Changes
    - Drop existing "Managers can view all profiles" policy
    - Create new policy that checks role from JWT metadata
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;

-- Create new policy using JWT metadata to avoid recursion
CREATE POLICY "Managers can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    auth.uid() = id
    OR
    -- Or user has manager/admin role in their JWT metadata
    (auth.jwt()->>'role') IN ('admin', 'operations', 'project_manager')
  );
