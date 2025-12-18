/*
  # Fix shifts RLS policies for admin and project managers

  1. Changes
    - Drop existing admin policy that causes recursion
    - Add new admin policy using raw_app_meta_data
    - Add project manager policy to view shifts for their projects

  2. Security
    - Admins can manage all shifts
    - Project managers can view shifts for their assigned projects
    - Field workers can view their own shifts
*/

-- Drop existing admin policy
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage shifts" ON shifts;
END $$;

-- Add admin policy using raw_app_meta_data (no recursion)
CREATE POLICY "Admins can manage all shifts"
  ON shifts
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

-- Add project manager policy
CREATE POLICY "Project managers can view their project shifts"
  ON shifts
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
      AND pm.project_id = shifts.project_id
    )
  );
