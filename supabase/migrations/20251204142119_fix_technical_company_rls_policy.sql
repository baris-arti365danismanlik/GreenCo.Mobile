/*
  # Fix Technical Company RLS Policy for Service Requests

  1. Changes
    - Drop the old complex policy with incorrect JOIN
    - Create a new simplified policy that correctly filters by:
      - Company specialties (for non-authorized service requests)
      - Authorized brands (for authorized service requests)
    - Remove dependency on non-existent companies table join
  
  2. Security
    - Technical companies can only see requests that match their specialties
    - For authorized service requests, they must be authorized for that brand
    - Only requests in visible statuses are shown
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Technical companies can view requests matching their specialtie" ON technical_service_requests;

-- Create new simplified policy
CREATE POLICY "Technical companies can view matching requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    -- User must be a technical company
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND
    -- Request must be in a visible status
    status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
    AND
    -- User must have a technical_company_id
    EXISTS (
      SELECT 1 
      FROM profiles p
      WHERE p.id = auth.uid() 
        AND p.technical_company_id IS NOT NULL
        AND (
          -- For authorized service requests: check authorized brands
          CASE 
            WHEN technical_service_requests.send_to_authorized_service = true THEN
              EXISTS (
                SELECT 1
                FROM company_authorized_brands cab
                WHERE cab.company_id = p.technical_company_id
                  AND cab.service_type_id = technical_service_requests.service_type_id
                  AND cab.brand_id = technical_service_requests.brand_id
              )
            -- For regular requests: check company specialties
            ELSE
              EXISTS (
                SELECT 1
                FROM technical_service_company_specialties tscs
                WHERE tscs.company_id = p.technical_company_id
                  AND tscs.service_type_id = technical_service_requests.service_type_id
              )
          END
        )
    )
  );
