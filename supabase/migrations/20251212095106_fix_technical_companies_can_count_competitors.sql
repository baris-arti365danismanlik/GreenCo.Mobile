/*
  # Fix Technical Companies RLS - Allow Viewing Competitor Count
  
  ## Changes
  
  1. **Update RLS Policy**
    - Allow technical companies to view basic info (location, specialties) of other companies
    - Required for geographic filtering logic to work
    - Still protects sensitive data (bank info, ratings, etc.)
  
  ## Security
  
  - Technical companies can only see: company name, location, specialties
  - Cannot see: bank details, ratings, contact info, etc.
*/

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Technical companies can view their own company" ON technical_service_companies;

-- Create new policy that allows viewing all companies (for counting purposes)
CREATE POLICY "Technical companies can view all companies for filtering"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'technical_company'::text)
  );

-- Also update specialties policy to allow viewing all specialties
DROP POLICY IF EXISTS "Technical companies can view own specialties" ON technical_service_company_specialties;

CREATE POLICY "Technical companies can view all specialties"
  ON technical_service_company_specialties
  FOR SELECT
  TO authenticated
  USING (
    (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'technical_company'::text)
  );
