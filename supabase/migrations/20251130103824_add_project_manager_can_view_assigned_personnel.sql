/*
  # Allow Project Managers to View Assigned Personnel

  1. New Policy
    - Project managers can view profiles of personnel assigned to their projects
    - Uses application-layer pattern: check via project_assignments
    - No recursion since we don't reference project_managers table from profiles

  2. Security
    - Only allows viewing personnel in manager's own projects
    - Checks through project_assignments table
    - No circular dependencies
*/

-- Allow project managers to view personnel assigned to their projects
CREATE POLICY "project_managers_view_assigned_personnel"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Check if this profile is assigned to any project where current user is manager
    EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.personnel_id = profiles.id
        AND pa.removed_at IS NULL
        AND pa.project_id IN (
          -- Use auth.uid() directly, no profiles table reference
          SELECT project_id 
          FROM project_managers 
          WHERE manager_id = auth.uid()
        )
    )
  );
