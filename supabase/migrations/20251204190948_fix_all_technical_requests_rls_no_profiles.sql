/*
  # Fix All Technical Service Requests RLS Policies

  ## Issue
  Multiple policies reference the profiles table causing infinite recursion.
  This prevents any user from accessing technical service requests.

  ## Solution
  Remove all policies that reference profiles table and recreate with JWT only.
  Keep business logic but use JWT app_metadata instead of profiles lookups.

  ## Changes
  - Drop all policies referencing profiles table
  - Recreate policies using only JWT and direct table checks
  - Maintain same access control logic
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Operations and admins can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations and admins can update requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations can update own company technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations can view own company technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Project managers can update assigned project technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Project managers can view assigned project technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view their active jobs" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies: authorized service requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies: regular requests" ON technical_service_requests;

-- Admin policies (already use JWT - keep as is)
-- "Admins can view all technical requests"
-- "Admins can update all technical requests"

-- Technical role policies (already use JWT - keep as is)  
-- "Technical role can view all requests"
-- "Technical role can create requests"
-- "Technical role can update requests"

-- Recreate INSERT policy for operations/project_manager using JWT only
CREATE POLICY "Operations and project managers can create requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('operations', 'project_manager', 'admin')
  );

-- Recreate operations SELECT policy without profiles reference
CREATE POLICY "Operations can view own company requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Recreate operations UPDATE policy without profiles reference
CREATE POLICY "Operations can update own company requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Recreate project manager SELECT policy without profiles reference
CREATE POLICY "Project managers can view assigned project requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
        AND pm.manager_id = auth.uid()
    )
  );

-- Recreate project manager UPDATE policy without profiles reference
CREATE POLICY "Project managers can update assigned project requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
        AND pm.manager_id = auth.uid()
    )
  );

-- Recreate technical company active jobs policy without profiles recursion
CREATE POLICY "Technical companies can view active jobs"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND EXISTS (
      SELECT 1 FROM technical_service_bids tsb
      WHERE tsb.request_id = technical_service_requests.id
        AND tsb.company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
        AND tsb.status = 'accepted'
    )
  );

-- Recreate authorized service requests policy without profiles
CREATE POLICY "Technical companies view authorized service requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
    AND send_to_authorized_service = true
    AND EXISTS (
      SELECT 1 FROM company_authorized_brands cab
      WHERE cab.company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
        AND cab.service_type_id = technical_service_requests.service_type_id
        AND cab.brand_id = technical_service_requests.brand_id
    )
    AND EXISTS (
      SELECT 1 FROM technical_service_companies tsc
      WHERE tsc.id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
        AND tsc.location_city = technical_service_requests.location_city
        AND (
          (
            (SELECT COUNT(DISTINCT tsc2.id) 
             FROM technical_service_companies tsc2
             JOIN company_authorized_brands cab2 ON cab2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND cab2.service_type_id = technical_service_requests.service_type_id
               AND cab2.brand_id = technical_service_requests.brand_id
               AND tsc2.is_active = true) >= 3
            AND tsc.location_district = technical_service_requests.location_district
          )
          OR
          (SELECT COUNT(DISTINCT tsc2.id)
           FROM technical_service_companies tsc2
           JOIN company_authorized_brands cab2 ON cab2.company_id = tsc2.id
           WHERE tsc2.location_city = technical_service_requests.location_city
             AND tsc2.location_district = technical_service_requests.location_district
             AND cab2.service_type_id = technical_service_requests.service_type_id
             AND cab2.brand_id = technical_service_requests.brand_id
             AND tsc2.is_active = true) < 3
        )
    )
  );

-- Recreate regular requests policy without profiles
CREATE POLICY "Technical companies view regular requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
    AND send_to_authorized_service = false
    AND EXISTS (
      SELECT 1 FROM technical_service_company_specialties tscs
      WHERE tscs.company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
        AND tscs.service_type_id = technical_service_requests.service_type_id
    )
    AND EXISTS (
      SELECT 1 FROM technical_service_companies tsc
      WHERE tsc.id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
        AND tsc.location_city = technical_service_requests.location_city
        AND (
          (
            (SELECT COUNT(DISTINCT tsc2.id)
             FROM technical_service_companies tsc2
             JOIN technical_service_company_specialties tscs2 ON tscs2.company_id = tsc2.id
             WHERE tsc2.location_city = technical_service_requests.location_city
               AND tsc2.location_district = technical_service_requests.location_district
               AND tscs2.service_type_id = technical_service_requests.service_type_id
               AND tsc2.is_active = true) >= 3
            AND tsc.location_district = technical_service_requests.location_district
          )
          OR
          (SELECT COUNT(DISTINCT tsc2.id)
           FROM technical_service_companies tsc2
           JOIN technical_service_company_specialties tscs2 ON tscs2.company_id = tsc2.id
           WHERE tsc2.location_city = technical_service_requests.location_city
             AND tsc2.location_district = technical_service_requests.location_district
             AND tscs2.service_type_id = technical_service_requests.service_type_id
             AND tsc2.is_active = true) < 3
        )
    )
  );
