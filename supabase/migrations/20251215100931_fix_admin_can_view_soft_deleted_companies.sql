/*
  # Fix Admin Can View Soft Deleted Companies

  ## Changes
  - Remove deleted_at IS NULL restriction from admin's SELECT policy
  - Admins can view all companies including soft-deleted ones
  - This fixes the RLS error when soft deleting companies

  ## Security
  - Only admins can see soft-deleted companies
  - Other users still cannot see deleted companies
*/

-- Drop and recreate admin SELECT policy without deleted_at restriction
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;

CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
