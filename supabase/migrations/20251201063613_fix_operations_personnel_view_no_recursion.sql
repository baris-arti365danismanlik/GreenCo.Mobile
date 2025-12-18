/*
  # Fix infinite recursion in operations personnel view policy

  1. Changes
    - Drop the problematic policy that causes recursion
    - Create a new policy that checks role = 'personnel' and operations role from JWT
    - Avoids table joins that cause recursion
    
  2. Security
    - Operations users can view all personnel profiles
    - This is safe because operations users create requests for personnel
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Operations can view personnel in their projects" ON profiles;

-- Allow operations to view all personnel profiles (no table joins to avoid recursion)
CREATE POLICY "Operations can view all personnel profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    profiles.role = 'personnel'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('operations', 'operations_manager')
  );
