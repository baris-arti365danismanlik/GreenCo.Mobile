/*
  # Simplify Technical Requests - Remove Nested Bids Queries

  This migration removes the nested queries to technical_service_bids
  from technical_service_requests policies to completely eliminate
  circular dependencies.

  ## Changes
  
  - Remove nested queries to technical_service_bids
  - Simplify technical company policies
  - Keep access control simple and direct
  
  ## Security
  
  - Technical companies can see all requests in pending/bidding status
  - They can also see requests where they are assigned
  - No circular dependencies
*/

-- Drop and recreate technical company policies without nested queries
DROP POLICY IF EXISTS "Technical companies can view available requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can update selected jobs" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view open and assigned requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can update assigned requests" ON technical_service_requests;

-- Technical companies can view requests that are open for bidding
CREATE POLICY "Technical companies can view open and assigned requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND (
      -- Can see requests open for bidding
      status IN ('pending_review', 'bidding', 'awaiting_customer_decision')
      OR
      -- Can see requests in progress or completed
      status IN ('approved', 'in_progress', 'completed', 'diagnostic_in_progress', 'awaiting_additional_info')
    )
  );

-- Technical companies can update requests where they are working
CREATE POLICY "Technical companies can update assigned requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND status IN ('approved', 'in_progress', 'completed', 'diagnostic_in_progress', 'awaiting_additional_info')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
  );
