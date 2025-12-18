/*
  # Fix Technical Service Requests SELECT RLS

  1. Changes
    - Update SELECT policy to use profiles table instead of app_metadata
    - Support project_manager, operations, and admin roles
    - Check service_modules for technical access

  2. Security
    - Users with 'technical' module can view all requests
    - Admin can view all requests
*/

-- Drop old SELECT policy
DROP POLICY IF EXISTS "Users with technical module can view requests" ON technical_service_requests;

-- Create new SELECT policy using profiles table
CREATE POLICY "Users with technical module can view requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (
          profiles.role IN ('operations', 'project_manager')
          AND 'technical' = ANY(profiles.service_modules)
        )
      )
    )
  );