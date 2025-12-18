/*
  # Add RLS policy for operations to view project personnel

  1. Changes
    - Add policy allowing operations users to view personnel profiles for projects they created requests for
    
  2. Security
    - Operations users can only see personnel assigned to projects they requested
    - Checks through personnel_requests -> project_assignments -> profiles chain
*/

-- Allow operations to view personnel assigned to their projects
CREATE POLICY "Operations can view personnel in their projects"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('operations', 'operations_manager')
    AND EXISTS (
      SELECT 1 
      FROM project_assignments pa
      JOIN personnel_requests pr ON pr.project_id = pa.project_id
      WHERE pa.personnel_id = profiles.id
        AND pr.requested_by = auth.uid()
        AND pa.removed_at IS NULL
    )
  );
