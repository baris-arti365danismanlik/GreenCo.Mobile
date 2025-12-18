/*
  # Fix attendance records RLS using JWT only

  1. Changes
    - Drop all existing policies
    - Create JWT-based policies (no table joins to profiles)

  2. Security
    - Admins can manage all records (JWT check)
    - Project managers can view their project records
    - Workers can manage their own records
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Company managers can view their company attendance" ON attendance_records;
DROP POLICY IF EXISTS "Field workers can manage their attendance" ON attendance_records;
DROP POLICY IF EXISTS "Project managers can view their project attendance records" ON attendance_records;

-- Admin: JWT only
CREATE POLICY "Admins manage all attendance"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Project managers: view their projects
CREATE POLICY "Project managers view project attendance"
  ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.manager_id = auth.uid()
      AND pm.project_id = attendance_records.project_id
    )
  );

-- Workers: manage own records
CREATE POLICY "Workers manage own attendance"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = worker_id
  )
  WITH CHECK (
    auth.uid() = worker_id
  );
