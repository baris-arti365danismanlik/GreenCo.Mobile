/*
  # Fix Companies UPDATE Policy - Remove WITH CHECK

  ## Problem
  - When soft-deleting a company, PostgreSQL checks both WITH CHECK and SELECT policies
  - The new row (with deleted_at set) fails SELECT policy validation
  - This causes "new row violates row-level security policy" error

  ## Solution
  - Remove WITH CHECK from UPDATE policy
  - Keep only USING clause for permission check
  - This allows UPDATE to succeed even if the resulting row wouldn't pass SELECT

  ## Security
  - Still checks admin permission via USING clause
  - Admin SELECT policy will filter out deleted companies from queries
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Admins can update companies" ON companies;

-- Recreate WITHOUT WITH CHECK
CREATE POLICY "Admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Ensure admin SELECT policy includes deleted_at filter
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;

CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND deleted_at IS NULL
  );
