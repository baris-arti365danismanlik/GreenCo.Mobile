/*
  # Fix Technical Service Requests UPDATE RLS - Use JWT

  1. Changes
    - Replace UPDATE policy to use JWT metadata directly
    - Avoid infinite recursion with profiles table
    - Support admin, operations, and project_manager roles

  2. Security
    - Only admin, operations, and project_manager can update
    - Admin has full access
    - Others must have 'technical' in service_modules
*/

-- Drop old UPDATE policy
DROP POLICY IF EXISTS "Operations and admins can update requests" ON technical_service_requests;

-- Create new UPDATE policy using JWT
CREATE POLICY "Operations and admins can update requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text IN ('admin', 'operations', 'project_manager')
    AND (
      (auth.jwt()->>'role')::text = 'admin'
      OR 'technical' = ANY(
        COALESCE(
          (SELECT service_modules FROM profiles WHERE id = auth.uid()),
          ARRAY[]::text[]
        )
      )
    )
  )
  WITH CHECK (
    (auth.jwt()->>'role')::text IN ('admin', 'operations', 'project_manager')
    AND (
      (auth.jwt()->>'role')::text = 'admin'
      OR 'technical' = ANY(
        COALESCE(
          (SELECT service_modules FROM profiles WHERE id = auth.uid()),
          ARRAY[]::text[]
        )
      )
    )
  );