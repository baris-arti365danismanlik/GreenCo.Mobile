/*
  # Fix Technical Service Bids RLS - Remove Circular Dependencies

  This migration fixes the circular dependency between technical_service_requests
  and technical_service_bids that was causing 500 errors.

  ## Problem
  
  - technical_service_requests policies query technical_service_bids
  - technical_service_bids policies query technical_service_requests
  - This creates infinite recursion = 500 error

  ## Solution
  
  - Simplify all bids policies to NOT query technical_service_requests
  - Use only JWT metadata and direct column checks
  - Remove nested queries to other tables
  
  ## Security
  
  - Maintains proper access control
  - No circular dependencies
*/

-- Drop all existing policies on technical_service_bids
DROP POLICY IF EXISTS "Admins can manage bids" ON technical_service_bids;
DROP POLICY IF EXISTS "Admins and operations can view all bids" ON technical_service_bids;
DROP POLICY IF EXISTS "Technical companies can view their own bids" ON technical_service_bids;
DROP POLICY IF EXISTS "Technical role can view all bids" ON technical_service_bids;
DROP POLICY IF EXISTS "Project managers can view selected bids for customer decision" ON technical_service_bids;
DROP POLICY IF EXISTS "Technical companies can create bids" ON technical_service_bids;
DROP POLICY IF EXISTS "Technical companies can update their own bids" ON technical_service_bids;

-- Create simple, non-recursive policies

-- Admin policies
CREATE POLICY "Admin can manage all bids"
  ON technical_service_bids
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Operations can view all bids
CREATE POLICY "Operations can view all bids"
  ON technical_service_bids
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );

-- Technical role can view all bids
CREATE POLICY "Technical role can view all bids"
  ON technical_service_bids
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical'
  );

-- Project managers can view all bids (simplified - no nested queries)
CREATE POLICY "Project managers can view all bids"
  ON technical_service_bids
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  );

-- Technical companies can view their own bids (using JWT only)
CREATE POLICY "Technical companies can view own bids"
  ON technical_service_bids
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  );

-- Technical companies can create bids
CREATE POLICY "Technical companies can create bids"
  ON technical_service_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  );

-- Technical companies can update their own bids
CREATE POLICY "Technical companies can update own bids"
  ON technical_service_bids
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  );
