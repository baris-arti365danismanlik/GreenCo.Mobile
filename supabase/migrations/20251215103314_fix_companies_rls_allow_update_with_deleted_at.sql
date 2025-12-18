/*
  # Fix Companies RLS - Allow Soft Delete Updates

  ## Root Cause
  When UPDATE sets deleted_at, PostgreSQL validates the new row against SELECT policies.
  The SELECT policy with "deleted_at IS NULL" rejects the new row, causing the error.

  ## Solution
  Admin SELECT policy must allow viewing deleted companies at the database level.
  Frontend will filter them out for display.

  ## Changes
  1. Remove deleted_at restriction from admin SELECT policy
  2. Keep UPDATE policy simple with only USING clause
  3. Frontend will handle filtering deleted companies

  ## Security
  - Admins can view all companies (including soft-deleted) in database
  - Frontend filters deleted companies from UI
  - Other roles still restricted to active companies only
*/

-- Fix admin SELECT policy to allow viewing deleted companies
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;

CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Ensure UPDATE policy is correct
DROP POLICY IF EXISTS "Admins can update companies" ON companies;

CREATE POLICY "Admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
