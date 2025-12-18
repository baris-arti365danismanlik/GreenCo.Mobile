/*
  # Add Operations Role SELECT Policy for Project Managers

  1. Changes
    - Add SELECT policy for operations role to view all project managers
    - This allows operations to see which managers are assigned to projects
    - Required for personnel request creation workflow

  2. Security
    - Operations can only SELECT (read), not modify
    - This is needed to show project manager information when creating personnel requests
*/

-- Drop policy if exists
DROP POLICY IF EXISTS "Operations view all project managers" ON project_managers;

-- Allow operations role to view all project managers
CREATE POLICY "Operations view all project managers"
  ON project_managers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
    )
  );
