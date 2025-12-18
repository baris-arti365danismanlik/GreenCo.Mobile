/*
  # Add UPDATE policy for technical_company users on technical_service_companies

  1. New Policy
    - Technical companies can update their own company information
      - Bank details
      - Contact information
      - Location details

  2. Security
    - Technical company users can only update their own company record
    - Verified through technical_company_id in profiles table
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Technical companies can update their own company" ON technical_service_companies;

-- Technical companies can update their own company
CREATE POLICY "Technical companies can update their own company"
  ON technical_service_companies
  FOR UPDATE
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND id IN (
      SELECT technical_company_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND id IN (
      SELECT technical_company_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );
