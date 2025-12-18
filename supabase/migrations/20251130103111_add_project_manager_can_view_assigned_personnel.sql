/*
  # Project Managers Can View Assigned Personnel

  1. New Policy
    - Allows project managers to view profiles of personnel assigned to their projects
    - Uses project_assignments and project_managers tables to determine access
    - Only applies to SELECT operations on profiles table

  2. Security
    - Restricted to authenticated users with project_manager role
    - Only personnel actively assigned to manager's projects are visible
    - Respects removed_at column to exclude removed assignments
*/

-- Allow project managers to view personnel in their projects
CREATE POLICY "project_managers_can_view_assigned_personnel"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the profile belongs to personnel assigned to any project the user manages
    EXISTS (
      SELECT 1 
      FROM project_managers pm
      JOIN project_assignments pa ON pa.project_id = pm.project_id
      WHERE pm.manager_id = auth.uid()
        AND pa.personnel_id = profiles.id
        AND pa.removed_at IS NULL
    )
  );
