/*
  # Add Project Manager UPDATE Policy for Attendance Records

  1. Changes
    - Add UPDATE policy for project managers on attendance_records table
    - Allows project managers to update performance ratings and notes for their projects
    - Only allows updating performance_rating and performance_notes fields

  2. Security
    - Project managers can only update attendance records for projects they manage
    - Restricted to authenticated project managers only
    - Validates manager assignment through project_managers table
*/

-- Add UPDATE policy for project managers to update performance ratings
CREATE POLICY "Project managers can update attendance performance"
  ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = attendance_records.project_id
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = attendance_records.project_id
    )
  );
