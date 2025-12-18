/*
  # Fix Operations Technical Service Requests - Require Technical Module

  1. Problem
    - Current policy allows ALL operations users to create technical service requests
    - Operations users WITHOUT 'technical' module can create technical requests
    - Example: Operations user (+905556663322) has ["personnel", "technical_service"] but NO "technical"
    
  2. Changes
    - Update Operations INSERT policy to check service_modules
    - Operations can ONLY create technical requests if they have 'technical' in service_modules
    - Consistent with Project Manager policy
    
  3. Security
    - Operations users must have 'technical' module to create technical service requests
    - Personnel-only operations users cannot create technical requests
    - Aligns with modular permissions architecture
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Operations can create technical requests" ON technical_service_requests;

-- Create corrected policy with service_modules check
CREATE POLICY "Operations can create technical requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
    AND (auth.jwt()->>'service_modules')::jsonb ? 'technical'
  );
