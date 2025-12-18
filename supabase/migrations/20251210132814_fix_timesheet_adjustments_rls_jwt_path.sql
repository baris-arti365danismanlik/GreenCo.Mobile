/*
  # Fix Timesheet Adjustments RLS - Correct JWT Path

  1. Changes
    - Fix JWT path to read role from app_metadata
    - Role is stored in auth.jwt()->'app_metadata'->>'role', not auth.jwt()->>'role'

  2. Security
    - Operations users with personnel module can insert/view adjustments
    - Admin users can insert/view adjustments
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Operations can insert adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Operations can view adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Admin can insert adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Admin can view adjustments" ON timesheet_adjustments;

-- Admin policies
CREATE POLICY "Admin can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role')::text = 'admin'
  );

CREATE POLICY "Admin can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role')::text = 'admin'
  );

-- Operations policies (with personnel module check)
CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role')::text = 'operations' AND
    (auth.jwt()->'app_metadata'->'service_modules')::jsonb ? 'personnel'
  );

CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->'app_metadata'->>'role')::text = 'operations' AND
    (auth.jwt()->'app_metadata'->'service_modules')::jsonb ? 'personnel'
  );