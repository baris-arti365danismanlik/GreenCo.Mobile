/*
  # Technical companies can view specialties

  ## Changes
  - Add SELECT policy for technical_company role to view their own company specialties
  
  ## Security
  - Technical companies can only view specialties for their own company
  - Uses JWT app_metadata to check role and company_id
*/

-- Allow technical companies to view their own company specialties
CREATE POLICY "Technical companies can view own specialties"
  ON technical_service_company_specialties
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  );
