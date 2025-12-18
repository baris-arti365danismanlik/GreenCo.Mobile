/*
  # Fix Companies RLS to Use JWT

  ## Issue
  Companies table policies use profiles table lookups which causes RLS recursion errors.
  This prevents admins from viewing technical requests with company joins.

  ## Solution
  Update admin policies to use JWT app_metadata instead of profiles table.

  ## Changes
  - Drop old admin policies that reference profiles table
  - Create new admin policies using JWT
  - Keep other role policies unchanged
*/

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can manage companies" ON companies;
DROP POLICY IF EXISTS "Admins with technical module can view all companies" ON companies;

-- Create new admin policies using JWT
CREATE POLICY "Admins can manage companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
