/*
  # Fix attendance records policies to avoid auth.users access

  1. Changes
    - Drop policies that query auth.users table
    - Create new policies using profiles.role instead
    - Add policies for admin and project manager access

  2. Security
    - Admins can view all attendance records
    - Project managers can view attendance records for their projects
*/

-- Drop problematic policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view all attendance records" ON attendance_records;
  DROP POLICY IF EXISTS "Project managers can view their project attendance" ON attendance_records;
  DROP POLICY IF EXISTS "Admins can manage attendance records" ON attendance_records;
END $$;

-- Allow admins to manage all attendance records (using profiles.role)
CREATE POLICY "Admins can manage all attendance records"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow project managers to view attendance records for their projects
CREATE POLICY "Project managers can view their project attendance records"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'project_manager'
    )
    AND EXISTS (
      SELECT 1 
      FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = attendance_records.project_id
    )
  );
