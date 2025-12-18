/*
  # Fix technical company bids RLS to use JWT only

  ## Changes
  - Drop existing INSERT policy that queries profiles table
  - Create new INSERT policy that only uses JWT metadata
  
  ## Security
  - Technical companies can only create bids with their own company_id
  - Uses JWT app_metadata directly to avoid RLS recursion
*/

-- Drop the old policy that queries profiles table
DROP POLICY IF EXISTS "Technical companies can create bids" ON technical_service_bids;

-- Create new policy using only JWT metadata
CREATE POLICY "Technical companies can create bids"
  ON technical_service_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id = (auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid
  );
