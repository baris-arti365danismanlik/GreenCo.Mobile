/*
  # Fix Duplicate UPDATE Policy Conflict for Companies

  1. Changes
    - Remove duplicate "Admins can soft delete companies" policy
    - Keep only "Admins can update companies" policy which handles all updates including soft deletes

  2. Security
    - Admin users can perform all UPDATE operations on companies including soft deletes
*/

-- Remove the duplicate soft delete policy
DROP POLICY IF EXISTS "Admins can soft delete companies" ON companies;

-- Verify the remaining update policy exists
-- This policy allows admins to perform all updates including soft deletes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'Admins can update companies'
  ) THEN
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
  END IF;
END $$;
