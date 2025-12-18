/*
  # Add UPDATE policy for project managers on personnel_requests

  1. Changes
    - Add UPDATE policy for project managers to update their own requests
    - Allow updates to status, cancelled_at, cancelled_by fields
    - Restrict to requests they created (requested_by = auth.uid())
  
  2. Security
    - Project managers can only update their own requests
    - Can update requests with status: pending, awaiting_assignment
    - Cannot update approved, rejected, completed, or already cancelled requests
*/

-- Add project manager update policy
CREATE POLICY "Project managers can update own requests"
  ON personnel_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = requested_by
    AND status IN ('pending', 'awaiting_assignment')
  )
  WITH CHECK (
    auth.uid() = requested_by
    AND status IN ('pending', 'awaiting_assignment', 'cancelled')
  );
