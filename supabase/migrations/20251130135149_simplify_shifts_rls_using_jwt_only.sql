/*
  # Simplify shifts RLS using JWT metadata only

  1. Changes
    - Drop ALL existing policies on shifts
    - Create simple policies using ONLY auth.jwt() metadata
    - No table joins, no recursion

  2. Security
    - Admins can manage all shifts (using JWT role)
    - Project managers can view shifts (check via project_managers table)
    - Workers can view their own shifts
*/

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Admins can manage all shifts" ON shifts;
DROP POLICY IF EXISTS "Admins can manage shifts" ON shifts;
DROP POLICY IF EXISTS "Project managers can view their project shifts" ON shifts;
DROP POLICY IF EXISTS "Company managers can manage their company shifts" ON shifts;
DROP POLICY IF EXISTS "Field workers can view their shifts" ON shifts;

-- Admin policy: use JWT metadata only
CREATE POLICY "Admins manage all shifts"
  ON shifts
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Project managers: can view shifts for their projects (only project_managers table check)
CREATE POLICY "Project managers view project shifts"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = shifts.project_id
    )
  );

-- Workers: view own shifts
CREATE POLICY "Workers view own shifts"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = worker_id
  );
