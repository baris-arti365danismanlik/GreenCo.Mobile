/*
  # Add Geographic Filtering to Technical Service Requests

  1. Changes
    - Update RLS policies to filter technical companies by location
    - Logic: 
      - Companies can only see requests in their city (location_city)
      - If 3+ companies in the request's district: only district companies see it
      - If <3 companies in the request's district: all city companies see it
  
  2. Security
    - Geographic filtering prevents showing nationwide requests
    - Smart district/city fallback ensures requests reach enough companies
    
  3. Notes
    - This applies to both regular and authorized service requests
    - The 3-company threshold ensures adequate competition
*/

-- Drop existing technical company policies
DROP POLICY IF EXISTS "Technical companies: regular requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies: authorized service requests" ON technical_service_requests;

-- Policy 1: Regular requests with geographic filtering
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
    AND
    -- Geographic filtering: must be in same city
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN technical_service_companies tsc ON tsc.id = p.technical_company_id
      WHERE p.id = auth.uid()
        AND tsc.location_city = technical_service_requests.location_city
        AND (
          -- Case 1: District has 3+ companies with this specialty - must be in same district
          (
            (SELECT COUNT(DISTINCT tsc2.id)
             FROM technical_service_companies tsc2
             JOIN technical_service_company_specialties tscs2 ON tscs2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND tscs2.service_type_id = technical_service_requests.service_type_id
               AND tsc2.is_active = true
            ) >= 3
            AND tsc.location_district = technical_service_requests.location_district
          )
          OR
          -- Case 2: District has <3 companies - any company in the city can see it
          (
            (SELECT COUNT(DISTINCT tsc2.id)
             FROM technical_service_companies tsc2
             JOIN technical_service_company_specialties tscs2 ON tscs2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND tscs2.service_type_id = technical_service_requests.service_type_id
               AND tsc2.is_active = true
            ) < 3
          )
        )
    )
  );

-- Policy 2: Authorized service requests with geographic filtering
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
    AND
    -- Geographic filtering: must be in same city
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN technical_service_companies tsc ON tsc.id = p.technical_company_id
      WHERE p.id = auth.uid()
        AND tsc.location_city = technical_service_requests.location_city
        AND (
          -- Case 1: District has 3+ authorized companies - must be in same district
          (
            (SELECT COUNT(DISTINCT tsc2.id)
             FROM technical_service_companies tsc2
             JOIN company_authorized_brands cab2 ON cab2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND cab2.service_type_id = technical_service_requests.service_type_id
               AND cab2.brand_id = technical_service_requests.brand_id
               AND tsc2.is_active = true
            ) >= 3
            AND tsc.location_district = technical_service_requests.location_district
          )
          OR
          -- Case 2: District has <3 authorized companies - any authorized company in the city can see it
          (
            (SELECT COUNT(DISTINCT tsc2.id)
             FROM technical_service_companies tsc2
             JOIN company_authorized_brands cab2 ON cab2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND cab2.service_type_id = technical_service_requests.service_type_id
               AND cab2.brand_id = technical_service_requests.brand_id
               AND tsc2.is_active = true
            ) < 3
          )
        )
    )
  );
