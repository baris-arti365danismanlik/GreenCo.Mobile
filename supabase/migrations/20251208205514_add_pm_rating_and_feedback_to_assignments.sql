/*
  # Add PM Rating and Feedback to Technical Service Assignments

  1. New Columns Added to technical_service_assignments
    - `pm_rating` (integer, 1-5 scale) - Project manager rating of the service
    - `pm_feedback` (text) - Project manager detailed feedback
    - `service_completion_status` (enum) - Status of service completion from PM perspective
    - `pm_evaluated_at` (timestamp) - When PM evaluated the service

  2. Changes
    - Add rating and feedback fields for project manager evaluation
    - Add service completion status to track incomplete/unsatisfactory work
    - Add evaluation timestamp for audit trail

  3. Security
    - RLS policies updated to allow project managers to update their evaluations
*/

-- Create enum for service completion status
DO $$ BEGIN
  CREATE TYPE service_completion_status AS ENUM (
    'satisfactory',
    'incomplete',
    'unsatisfactory',
    'requires_rework'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add rating and feedback columns
ALTER TABLE technical_service_assignments
  ADD COLUMN IF NOT EXISTS pm_rating integer CHECK (pm_rating >= 1 AND pm_rating <= 5),
  ADD COLUMN IF NOT EXISTS pm_feedback text,
  ADD COLUMN IF NOT EXISTS service_completion_status service_completion_status,
  ADD COLUMN IF NOT EXISTS pm_evaluated_at timestamptz;

-- Add comment for clarity
COMMENT ON COLUMN technical_service_assignments.pm_rating IS 'Project manager rating (1-5 scale)';
COMMENT ON COLUMN technical_service_assignments.pm_feedback IS 'Project manager detailed feedback';
COMMENT ON COLUMN technical_service_assignments.service_completion_status IS 'Service completion status from PM perspective';
COMMENT ON COLUMN technical_service_assignments.pm_evaluated_at IS 'Timestamp when PM evaluated the service';

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Project managers can update their evaluations" ON technical_service_assignments;

CREATE POLICY "Project managers can update their evaluations"
  ON technical_service_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM technical_service_requests tsr
      JOIN project_managers pm ON pm.project_id = tsr.project_id
      WHERE tsr.id = technical_service_assignments.request_id
        AND pm.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM technical_service_requests tsr
      JOIN project_managers pm ON pm.project_id = tsr.project_id
      WHERE tsr.id = technical_service_assignments.request_id
        AND pm.manager_id = auth.uid()
    )
  );
