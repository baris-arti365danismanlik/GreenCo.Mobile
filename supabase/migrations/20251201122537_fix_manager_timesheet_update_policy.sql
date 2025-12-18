/*
  # Fix Project Manager Timesheet Update Policy

  ## Changes
  
  ### `timesheet_periods` table
  - Update existing manager policy to include WITH CHECK clause
  - Ensures managers can only update timesheets for projects they manage
  
  ## Security
  
  - Prevents policy conflicts by adding proper WITH CHECK
  - Maintains manager authority over their projects only
  
  ## Notes
  
  - The existing policy had no WITH CHECK clause which could cause UPDATE failures
  - This migration drops and recreates the policy with proper constraints
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Managers update timesheets" ON timesheet_periods;

-- Recreate with proper WITH CHECK clause
CREATE POLICY "Managers update timesheets"
  ON timesheet_periods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_managers
      WHERE project_managers.project_id = timesheet_periods.project_id
      AND project_managers.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_managers
      WHERE project_managers.project_id = timesheet_periods.project_id
      AND project_managers.manager_id = auth.uid()
    )
  );
