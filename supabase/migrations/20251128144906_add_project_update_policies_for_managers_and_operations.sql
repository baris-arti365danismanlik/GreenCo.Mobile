/*
  # Add UPDATE policies for projects_greenco table

  1. Changes
    - Add UPDATE policy for project managers to update their assigned projects
    - Add UPDATE policy for operations role to update all projects
  
  2. Security
    - Project managers can only update projects they are assigned to
    - Operations users can update all projects
    - Admins already have ALL permissions via existing policy
*/

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Project managers can update assigned projects" ON projects_greenco;
  DROP POLICY IF EXISTS "Operations can update all projects" ON projects_greenco;
END $$;

-- Project managers can update their assigned projects
CREATE POLICY "Project managers can update assigned projects"
  ON projects_greenco
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM project_managers
      WHERE project_managers.project_id = projects_greenco.id
      AND project_managers.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM project_managers
      WHERE project_managers.project_id = projects_greenco.id
      AND project_managers.manager_id = auth.uid()
    )
  );

-- Operations can update all projects
CREATE POLICY "Operations can update all projects"
  ON projects_greenco
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'operations'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'operations'
  );
