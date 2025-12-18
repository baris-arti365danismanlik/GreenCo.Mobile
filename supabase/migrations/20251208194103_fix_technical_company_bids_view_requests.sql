/*
  # Fix Technical Company Bids - Allow Viewing Bidded Requests

  1. Problem
    - Technical companies can see their bids count in dashboard
    - But when loading bid details with nested requests, RLS blocks access
    - Current policy only allows viewing requests in specific statuses
    - After bidding, request status may change and company loses access

  2. Solution
    - Add new SELECT policy for technical_service_requests
    - Allow technical companies to view requests where they have submitted bids
    - This ensures they can always see requests they've bid on, regardless of status

  3. Security
    - Policy checks that user has a bid on the request
    - Only allows SELECT, not INSERT/UPDATE/DELETE
*/

-- Drop policy if it exists
DROP POLICY IF EXISTS "Technical companies can view own bid requests" ON technical_service_requests;

-- Allow technical companies to view requests where they have bids
CREATE POLICY "Technical companies can view own bid requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') = 'technical_company'
    AND EXISTS (
      SELECT 1
      FROM technical_service_bids b
      WHERE b.request_id = technical_service_requests.id
        AND b.company_id = ((auth.jwt() -> 'app_metadata')::jsonb ->> 'technical_company_id')::uuid
    )
  );
