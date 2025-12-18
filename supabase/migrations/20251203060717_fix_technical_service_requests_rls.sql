/*
  # Fix Technical Service Requests RLS Policies

  1. Changes
    - Update INSERT policy to check profiles table role
    - Update UPDATE policy to check profiles table role
    - Support operations users with 'technical' module access

  2. Security
    - Only operations and admin roles can create/update
    - Must have 'technical' in service_modules OR be admin
*/

-- Drop old INSERT policy
DROP POLICY IF EXISTS "Operations and admins can create requests" ON technical_service_requests;

-- Create new INSERT policy checking profiles table
CREATE POLICY "Operations and admins can create requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations')
      AND (
        profiles.role = 'admin'
        OR 'technical' = ANY(profiles.service_modules)
      )
    )
  );

-- Drop old UPDATE policy
DROP POLICY IF EXISTS "Operations and admins can update requests" ON technical_service_requests;

-- Create new UPDATE policy checking profiles table
CREATE POLICY "Operations and admins can update requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations')
      AND (
        profiles.role = 'admin'
        OR 'technical' = ANY(profiles.service_modules)
      )
    )
  );