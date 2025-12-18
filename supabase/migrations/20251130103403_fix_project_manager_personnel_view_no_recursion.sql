/*
  # Fix Project Manager Personnel View - Remove Recursion

  1. Changes
    - Drop the recursive policy that causes infinite recursion
    - Create a new simpler policy that directly checks project_assignments
    - Avoids JOIN with project_managers to prevent recursion

  2. Security
    - Still maintains proper access control
    - Project managers can only see personnel in their projects
    - Uses direct table queries without recursion
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "project_managers_can_view_assigned_personnel" ON profiles;

-- Create a simpler non-recursive policy
-- This checks if the viewing user is a project manager for any project
-- where the profile being viewed is assigned as personnel
CREATE POLICY "project_managers_can_view_assigned_personnel"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if profile is assigned to a project managed by current user
    id IN (
      SELECT pa.personnel_id
      FROM project_assignments pa
      WHERE pa.project_id IN (
        SELECT project_id 
        FROM project_managers 
        WHERE manager_id = auth.uid()
      )
      AND pa.removed_at IS NULL
    )
  );
