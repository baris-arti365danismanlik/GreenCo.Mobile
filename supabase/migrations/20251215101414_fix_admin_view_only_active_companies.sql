/*
  # Fix Admin View Only Active Companies

  ## Changes
  - Add deleted_at IS NULL restriction back to admin's SELECT policy
  - Update the UPDATE policy to allow soft delete operations without WITH CHECK conflict
  - Admin can only see active companies but can still soft delete them

  ## Security
  - Only admins can soft delete companies
  - Admins only see active (non-deleted) companies in listings
  - Soft delete operations bypass the deleted_at restriction in UPDATE
*/

-- Update admin SELECT policy to show only active companies
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;

CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND deleted_at IS NULL
  );

-- Update the UPDATE policy to specifically allow soft delete
-- We remove WITH CHECK to allow updating deleted_at without restrictions
DROP POLICY IF EXISTS "Admins can update companies" ON companies;

CREATE POLICY "Admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
