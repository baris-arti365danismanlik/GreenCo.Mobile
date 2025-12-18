/*
  # Fix Technical Service Requests RLS - Remove Circular Dependencies

  This migration fixes the 500 error when querying technical_service_requests
  by ensuring there are no circular dependencies through the profiles table.

  ## Changes
  
  1. Simplify RLS policies to avoid nested subqueries
  2. Ensure all policies use only JWT metadata where possible
  3. Remove any potential circular dependencies
  
  ## Security
  
  - Maintains proper access control using JWT claims
  - Admin users can view all requests
  - Other roles have appropriate scoped access
*/

-- First, let's ensure the admin policy is the simplest and most direct
-- Drop and recreate to ensure clean state
DROP POLICY IF EXISTS "Admins can view all technical requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Admins can update all technical requests" ON technical_service_requests;

-- Recreate admin policies with highest priority
CREATE POLICY "Admins can view all technical requests"
  ON technical_service_requests
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update all technical requests"
  ON technical_service_requests
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Ensure admin can insert as well
DROP POLICY IF EXISTS "Admins can create technical requests" ON technical_service_requests;
CREATE POLICY "Admins can create technical requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
