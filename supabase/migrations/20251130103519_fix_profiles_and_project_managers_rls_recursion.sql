/*
  # Fix RLS Infinite Recursion Between profiles and project_managers

  1. Problem
    - profiles policies check project_managers table
    - project_managers policies check profiles table
    - This creates infinite recursion

  2. Solution
    - Use auth.jwt() to get role directly from JWT instead of profiles table
    - Eliminates circular dependency
    - Both tables can check each other without recursion

  3. Changes
    - Update project_managers policies to use JWT role check
    - Keep profiles policies as is (they now work without recursion)
*/

-- Drop and recreate project_managers policies using JWT instead of profiles table

DROP POLICY IF EXISTS "Admins manage project managers" ON project_managers;
DROP POLICY IF EXISTS "Operations view all project managers" ON project_managers;

-- Admins can manage all project managers (using JWT)
CREATE POLICY "Admins manage project managers"
  ON project_managers
  FOR ALL
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') = 'admin'
  );

-- Operations can view all project managers (using JWT)
CREATE POLICY "Operations view all project managers"
  ON project_managers
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') IN ('operations', 'operations_manager', 'admin')
  );
