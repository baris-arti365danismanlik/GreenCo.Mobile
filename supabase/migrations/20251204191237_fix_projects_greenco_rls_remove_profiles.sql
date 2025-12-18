/*
  # Fix Projects Greenco RLS - Remove Profiles References

  ## Issue
  projects_greenco policies reference profiles table causing recursion
  when accessed through technical_service_requests -> companies -> projects chain.

  ## Solution
  Update all policies to use JWT only, no profiles lookups.

  ## Changes
  - Drop all policies referencing profiles
  - Recreate using JWT app_metadata
*/

-- Drop policies that reference profiles
DROP POLICY IF EXISTS "Admins can manage work sites" ON projects_greenco;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects_greenco;
DROP POLICY IF EXISTS "Company managers can manage their work sites" ON projects_greenco;
DROP POLICY IF EXISTS "Operations can update own company projects" ON projects_greenco;
DROP POLICY IF EXISTS "Operations can view own company projects" ON projects_greenco;
DROP POLICY IF EXISTS "Technical module users can view all projects" ON projects_greenco;

-- Admin policies using JWT
CREATE POLICY "Admins can view all projects"
  ON projects_greenco FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can manage projects"
  ON projects_greenco FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Operations policies using JWT
CREATE POLICY "Operations can view own company projects"
  ON projects_greenco FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

CREATE POLICY "Operations can update own company projects"
  ON projects_greenco FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Technical role can view all projects (no profiles lookup needed)
CREATE POLICY "Technical role can view all projects"
  ON projects_greenco FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  );

-- Company managers (using JWT company_id)
CREATE POLICY "Company users can view their projects"
  ON projects_greenco FOR SELECT
  TO authenticated
  USING (
    company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Keep existing policies that don't reference profiles
-- "Field workers can view their assigned work sites"
-- "Project managers can update assigned projects"  
-- "Project managers can view assigned projects"
