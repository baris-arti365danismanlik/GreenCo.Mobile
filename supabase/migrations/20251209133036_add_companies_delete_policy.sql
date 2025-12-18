/*
  # Add DELETE policy for companies table

  1. Changes
    - Add explicit DELETE policy for admin users on companies table
    - This ensures admins can delete companies (and CASCADE will handle related records)
  
  2. Security
    - Only admin role can delete companies
    - Uses JWT metadata for role checking
*/

-- Drop existing ALL policy and recreate with separate policies
DROP POLICY IF EXISTS "Admins can manage companies" ON companies;

-- Add separate INSERT, UPDATE, DELETE policies for better clarity
CREATE POLICY "Admins can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

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

CREATE POLICY "Admins can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
