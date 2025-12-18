/*
  # Fix Companies UPDATE Policy with WITH CHECK

  ## Changes
  - Drop and recreate the admin update policy with WITH CHECK clause
  - This fixes the RLS error when updating companies (including soft delete)

  ## Security
  - Admins can update any company
  - WITH CHECK ensures the updated row also passes admin check
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Admins can update companies" ON companies;

-- Recreate with WITH CHECK
CREATE POLICY "Admins can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
