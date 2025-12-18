/*
  # Add RLS policies for technical_company users on technical_service_requests

  1. New Policies
    - Technical companies can view requests in bidding status
      - Allows them to see available requests they can bid on
    - Technical companies can view requests where they have accepted bids
      - Allows them to see their active jobs

  2. Security
    - Technical company users can only:
      - View requests open for bidding (status = 'bidding')
      - View requests where they have an accepted bid
    - They cannot modify requests (only Operations/Admin/PM can)
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Technical companies can view bidding requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Technical companies can view their active jobs" ON technical_service_requests;

-- Technical companies can view requests in bidding status
CREATE POLICY "Technical companies can view bidding requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND status = 'bidding'
  );

-- Technical companies can view requests where they have accepted bids (active jobs)
CREATE POLICY "Technical companies can view their active jobs"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'technical_company'
    AND EXISTS (
      SELECT 1 
      FROM technical_service_bids tsb
      INNER JOIN profiles p ON p.technical_company_id = tsb.company_id
      WHERE tsb.request_id = technical_service_requests.id
      AND tsb.status = 'accepted'
      AND p.id = auth.uid()
    )
  );
