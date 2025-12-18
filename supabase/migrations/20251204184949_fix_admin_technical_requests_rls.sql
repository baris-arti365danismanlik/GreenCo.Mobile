/*
  # Fix Admin RLS for Technical Service Requests

  ## Issue
  Admin policy uses profiles table check while other policies use JWT app_metadata.
  This inconsistency prevents admins from viewing technical requests.

  ## Solution
  Update admin policies to use JWT app_metadata like other role checks.

  ## Changes
  - Drop old admin SELECT policy
  - Create new admin SELECT policy using JWT
  - Ensure consistency with other role-based policies
*/

-- Drop existing admin SELECT policy
DROP POLICY IF EXISTS "Admins can view all technical requests" ON technical_service_requests;

-- Create new admin SELECT policy using JWT
CREATE POLICY "Admins can view all technical requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Also update the UPDATE policy for consistency
DROP POLICY IF EXISTS "Admins can update all technical requests" ON technical_service_requests;

CREATE POLICY "Admins can update all technical requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
