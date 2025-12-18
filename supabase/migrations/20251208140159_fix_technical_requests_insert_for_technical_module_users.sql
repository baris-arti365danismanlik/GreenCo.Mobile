/*
  # Fix technical service requests INSERT policy for technical module users

  1. Problem
    - Users with 'technical' in their service_modules cannot create technical service requests
    - Current policies only allow INSERT for specific roles (admin, project_manager, operations, technical)
    - But users with service_modules containing 'technical' should also be able to create requests
  
  2. Solution
    - Add a new INSERT policy that allows users with 'technical' in their service_modules
    - This allows project_managers and operations users who have technical module access to create requests
  
  3. Security
    - Only authenticated users with 'technical' in their profile's service_modules can INSERT
    - Maintains proper access control
*/

-- Drop the old technical role INSERT policy as we'll replace it with a broader one
DROP POLICY IF EXISTS "Technical role can create requests" ON technical_service_requests;

-- Create a new policy that allows users with technical module to create requests
CREATE POLICY "Users with technical module can create requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE service_modules @> ARRAY['technical']::text[]
    )
  );
