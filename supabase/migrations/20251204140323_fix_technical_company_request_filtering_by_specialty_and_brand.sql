/*
  # Technical Company Request Filtering - Fix Authorization Logic

  ## Overview
  This migration fixes a critical security and business logic issue where ALL technical companies
  could see ALL service requests regardless of their specialties or authorized brands.

  ## Problem
  The previous RLS policy only checked:
  - User role = 'technical_company'
  - Request status = 'bidding'
  
  This allowed companies to see and bid on requests outside their expertise and authorization.

  ## Solution
  Replace the overly permissive policy with a comprehensive one that checks:
  1. Company must be specialized in the service type
  2. For authorized service requests (send_to_authorized_service=true):
     - Company must be authorized for the specific brand
  3. For non-authorized service requests (send_to_authorized_service=false):
     - Company only needs to be specialized in the service type

  ## Changes
  1. Drop old permissive policies:
     - "Technical companies can view bidding requests"
     - "Technical companies can view all service requests"
  
  2. Add new restrictive policy:
     - "Technical companies can view requests matching their specialties and authorizations"

  ## Security Impact
  - Prevents companies from seeing requests outside their expertise
  - Enforces brand authorization requirements
  - Maintains data privacy and business logic integrity
*/

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Technical companies can view bidding requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view all service requests" ON technical_service_requests;

-- Create new comprehensive policy for technical companies
CREATE POLICY "Technical companies can view requests matching their specialties and authorizations"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    -- Must be a technical_company role
    (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'technical_company')
    AND
    -- Request must be in viewable status
    (status = ANY (ARRAY[
      'pending_review'::technical_service_request_status,
      'info_needed'::technical_service_request_status, 
      'bidding'::technical_service_request_status,
      'approved'::technical_service_request_status,
      'in_progress'::technical_service_request_status
    ]))
    AND
    -- Get the company_id for the current user
    (
      EXISTS (
        SELECT 1 
        FROM profiles p
        WHERE p.id = auth.uid()
        AND p.technical_company_id IS NOT NULL
        AND (
          -- Check if request requires authorized service
          CASE 
            WHEN technical_service_requests.send_to_authorized_service = true THEN
              -- Company must be authorized for this specific brand
              EXISTS (
                SELECT 1
                FROM company_authorized_brands cab
                WHERE cab.company_id = (
                  SELECT company_id 
                  FROM companies c
                  INNER JOIN technical_service_companies tsc ON c.id::text = tsc.id::text
                  WHERE tsc.id = p.technical_company_id
                  LIMIT 1
                )
                AND cab.service_type_id = technical_service_requests.service_type_id
                AND cab.brand_id = technical_service_requests.brand_id
              )
            ELSE
              -- Company only needs to be specialized in this service type
              EXISTS (
                SELECT 1
                FROM technical_service_company_specialties tscs
                WHERE tscs.company_id = p.technical_company_id
                AND tscs.service_type_id = technical_service_requests.service_type_id
              )
          END
        )
      )
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Technical companies can view requests matching their specialties and authorizations" 
  ON technical_service_requests IS 
  'Restricts technical companies to only see requests that match their registered specialties. 
   For authorized service requests, companies must also be authorized for the specific brand.';
