/*
  # Fix Technical Company RLS Policies

  1. Changes
    - Remove duplicate/incorrect policy from technical_service_companies
    - Fix technical_service_assignments policies to use JWT directly instead of profiles
    - Fix technical_service_info_requests policies to use JWT directly

  2. Security
    - All policies use JWT metadata correctly
    - No recursive dependencies on profiles table
*/

-- Drop incorrect/duplicate policy
DROP POLICY IF EXISTS "Technical company users can view their own company" ON technical_service_companies;

-- Fix technical_service_assignments policies to use JWT directly
DROP POLICY IF EXISTS "Technical companies can view their assignments" ON technical_service_assignments;
DROP POLICY IF EXISTS "Technical companies can update their assignments" ON technical_service_assignments;

CREATE POLICY "Technical companies can view their assignments"
  ON technical_service_assignments FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
  );

CREATE POLICY "Technical companies can update their assignments"
  ON technical_service_assignments FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
  );

-- Fix technical_service_info_requests policies to use JWT directly
DROP POLICY IF EXISTS "Technical companies can view their info requests" ON technical_service_info_requests;

CREATE POLICY "Technical companies can view their info requests"
  ON technical_service_info_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND requested_by_company = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
  );
