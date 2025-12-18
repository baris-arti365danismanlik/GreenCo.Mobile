/*
  # Debug Timesheet Adjustments RLS

  1. Changes
    - Add admin policy to test if policies work at all
    - Simplify operations policy to check JWT structure
    - Add temporary logging-friendly policies

  2. Security
    - Temporary - will be refined after understanding JWT structure
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Operations can insert adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Operations can view adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Admin can insert adjustments" ON timesheet_adjustments;
DROP POLICY IF EXISTS "Admin can view adjustments" ON timesheet_adjustments;

-- Admin policies (for testing)
CREATE POLICY "Admin can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'admin'
  );

CREATE POLICY "Admin can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'admin'
  );

-- Try simpler operations policy - check if role is in JWT directly
CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role')::text = 'operations'
  );

CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'operations'
  );