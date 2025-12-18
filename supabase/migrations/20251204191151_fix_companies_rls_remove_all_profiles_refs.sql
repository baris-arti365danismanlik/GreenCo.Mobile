/*
  # Fix Companies RLS - Remove All Profiles References

  ## Issue
  Companies table policies still reference profiles table.
  When technical_service_requests joins with companies, this creates recursion.

  ## Solution
  Update all companies policies to use only JWT, no profiles lookups.

  ## Changes
  - Drop policies that reference profiles
  - Recreate using JWT app_metadata only
*/

-- Drop policies that reference profiles
DROP POLICY IF EXISTS "Company managers can view their company" ON companies;
DROP POLICY IF EXISTS "Operations users can view their authorized company" ON companies;
DROP POLICY IF EXISTS "Project managers can view assigned project companies" ON companies;

-- Recreate operations policy using JWT only
CREATE POLICY "Operations can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Recreate project managers policy using JWT and direct table check only
CREATE POLICY "Project managers can view project companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      JOIN projects_greenco p ON p.id = pm.project_id
      WHERE pm.manager_id = auth.uid()
        AND p.company_id = companies.id
    )
  );

-- Company managers can view their company (using JWT)
CREATE POLICY "Company users can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );
