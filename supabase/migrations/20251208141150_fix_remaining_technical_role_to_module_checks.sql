/*
  # Fix Remaining Technical Role References to Use Service Modules

  ## Problem
  Some RLS policies still check for `role = 'technical'` but this role doesn't exist.
  Previous migration partially applied - this completes the fix.

  ## Solution
  Replace remaining `role = 'technical'` checks with service_modules array checks.

  ## Changes
  1. company_authorized_brands: 1 policy
  2. projects_greenco: 1 policy  
  3. technical_service_requests: 2 policies (view, update)
  4. technical_service_bids: 1 policy

  Note: "Users with technical module can create requests" already exists, skipping.

  ## Security
  - No change to access logic
  - Just fixing the check method (role → module)
  - Maintains all existing security boundaries
*/

-- ============================================
-- 1. FIX: company_authorized_brands
-- ============================================

DROP POLICY IF EXISTS "Technical can view company authorized brands" ON company_authorized_brands;

CREATE POLICY "Users with technical module can view company authorized brands"
  ON company_authorized_brands
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );

-- ============================================
-- 2. FIX: projects_greenco
-- ============================================

DROP POLICY IF EXISTS "Technical role can view all projects" ON projects_greenco;

CREATE POLICY "Users with technical module can view all projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );

-- ============================================
-- 3. FIX: technical_service_requests
-- ============================================

DROP POLICY IF EXISTS "Technical role can view all requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical role can update requests" ON technical_service_requests;

CREATE POLICY "Users with technical module can view all requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );

CREATE POLICY "Users with technical module can update requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );

-- ============================================
-- 4. FIX: technical_service_bids
-- ============================================

DROP POLICY IF EXISTS "Technical role can view all bids" ON technical_service_bids;

CREATE POLICY "Users with technical module can view all bids"
  ON technical_service_bids
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );
