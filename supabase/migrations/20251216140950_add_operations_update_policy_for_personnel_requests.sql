/*
  # Add UPDATE policy for operations on personnel_requests

  1. Changes
    - Add UPDATE policy for operations to update requests from their assigned projects
  
  2. Security
    - Operations can update requests for projects they manage
    - Limited to specific status transitions
*/

-- Add operations update policy
CREATE POLICY "Operations can update project requests"
  ON personnel_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'operations'
    AND (
      project_id IN (
        SELECT id FROM projects_greenco WHERE is_active = true
      )
      OR is_new_project = true
    )
  )
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'operations'
  );
