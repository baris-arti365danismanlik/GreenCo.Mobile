/*
  # Simplify Technical Company RLS Policy

  1. Changes
    - Drop complex policy
    - Create two separate simpler policies:
      - One for regular requests (check specialty)
      - One for authorized service requests (check authorized brands)
  
  2. Security
    - Technical companies see only matching requests
    - Clear separation between regular and authorized service flows
*/

-- Drop the current policy
DROP POLICY IF EXISTS "Technical companies can view matching requests" ON technical_service_requests;

-- Policy 1: Regular requests (not authorized service)
CREATE POLICY "Technical companies: regular requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Must be technical_company role
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND
    -- Must be in visible status
    status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
    AND
    -- NOT an authorized service request
    send_to_authorized_service = false
    AND
    -- Company must have this specialty
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN technical_service_company_specialties tscs 
        ON tscs.company_id = p.technical_company_id
      WHERE p.id = auth.uid()
        AND p.technical_company_id IS NOT NULL
        AND tscs.service_type_id = technical_service_requests.service_type_id
    )
  );

-- Policy 2: Authorized service requests
CREATE POLICY "Technical companies: authorized service requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Must be technical_company role
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND
    -- Must be in visible status
    status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
    AND
    -- IS an authorized service request
    send_to_authorized_service = true
    AND
    -- Company must be authorized for this brand
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN company_authorized_brands cab 
        ON cab.company_id = p.technical_company_id
      WHERE p.id = auth.uid()
        AND p.technical_company_id IS NOT NULL
        AND cab.service_type_id = technical_service_requests.service_type_id
        AND cab.brand_id = technical_service_requests.brand_id
    )
  );
