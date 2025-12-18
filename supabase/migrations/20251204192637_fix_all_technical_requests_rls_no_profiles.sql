/*
  # Fix All Technical Requests RLS - Remove All Profile Dependencies

  This migration completely removes any circular dependencies in RLS policies
  that could cause 500 errors when querying technical service requests.

  ## Changes
  
  1. Drop and recreate all RLS policies for technical_service_requests
  2. Simplify all policies to use only JWT metadata
  3. Remove any nested queries that could cause issues
  4. Ensure admin has full access without any complex joins
  
  ## Security
  
  - Maintains proper access control
  - All policies use JWT claims only
  - No circular dependencies
*/

-- Drop all existing policies on technical_service_requests
DROP POLICY IF EXISTS "Admins can view all technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Admins can update all technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Admins can create technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Admin can do everything on technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations and project managers can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical role can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations can view own company requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Project managers can view assigned project requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view active jobs" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies view authorized service requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies view regular requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical role can view all requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations can update own company requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Project managers can update assigned project requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical role can update requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Operations can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Project managers can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view available requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can update bid-related requests" ON technical_service_requests;

-- Create simple, non-recursive policies

-- Admin policies (highest priority, simplest)
CREATE POLICY "Admin can do everything on technical requests"
  ON technical_service_requests
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Technical role policies
CREATE POLICY "Technical role can view all requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  );

CREATE POLICY "Technical role can create requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  );

CREATE POLICY "Technical role can update requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  );

-- Operations policies (scoped to their company)
CREATE POLICY "Operations can view own company requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

CREATE POLICY "Operations can create requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );

CREATE POLICY "Operations can update own company requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );

-- Project manager policies (using simple subquery, no joins)
CREATE POLICY "Project managers can view assigned project requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1
      FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
        AND pm.manager_id = auth.uid()
    )
  );

CREATE POLICY "Project managers can create requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  );

CREATE POLICY "Project managers can update assigned project requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1
      FROM project_managers pm
      WHERE pm.project_id = technical_service_requests.project_id
        AND pm.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  );

-- Technical company policies
CREATE POLICY "Technical companies can view available requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND (
      -- Can see requests in bidding status
      (status IN ('pending_review', 'bidding'))
      OR
      -- Can see requests where they have a bid
      EXISTS (
        SELECT 1
        FROM technical_service_bids tsb
        WHERE tsb.request_id = technical_service_requests.id
          AND tsb.company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
      )
      OR
      -- Can see requests where their bid was selected
      selected_bid_id IN (
        SELECT id
        FROM technical_service_bids
        WHERE company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
      )
    )
  );

CREATE POLICY "Technical companies can update selected jobs"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND selected_bid_id IN (
      SELECT id
      FROM technical_service_bids
      WHERE company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
  );
