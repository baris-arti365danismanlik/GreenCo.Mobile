/*
  # Add attendance records select policies for admin and project managers

  1. Changes
    - Add policy for admins to select all attendance records
    - Add policy for project managers to select attendance records of personnel in their projects

  2. Security
    - Admins can view all attendance records
    - Project managers can view attendance records only for their assigned projects
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view all attendance records" ON attendance_records;
  DROP POLICY IF EXISTS "Project managers can view their project attendance" ON attendance_records;
END $$;

-- Allow admins to select all attendance records
CREATE POLICY "Admins can view all attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Allow project managers to view attendance records for their projects
CREATE POLICY "Project managers can view their project attendance"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'project_manager'
    AND EXISTS (
      SELECT 1 
      FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = attendance_records.project_id
    )
  );
