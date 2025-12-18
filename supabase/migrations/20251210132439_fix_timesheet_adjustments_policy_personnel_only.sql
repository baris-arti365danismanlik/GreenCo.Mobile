/*
  # Fix Timesheet Adjustments Policy - Personnel Module Only

  1. Changes
    - Update INSERT policy to only require personnel module (not technical_services)
    - Update SELECT policy to only require personnel module
    - Timesheet adjustments are part of personnel management, not technical services

  2. Security
    - Operations users with personnel module can manage timesheet adjustments
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Operations can insert adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Operations can view adjustments" ON timesheet_adjustments;

-- Recreate with correct module check (personnel only)
CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'operations'
    AND 'personnel' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE((auth.jwt()->'app_metadata'->'service_modules')::jsonb, '[]'::jsonb)
      )
    )
  );

CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'operations'
    AND 'personnel' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE((auth.jwt()->'app_metadata'->'service_modules')::jsonb, '[]'::jsonb)
      )
    )
  );