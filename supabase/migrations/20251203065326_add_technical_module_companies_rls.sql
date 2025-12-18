/*
  # Add Technical Module Users Can View All Companies

  1. Changes
    - Add SELECT policy for users with 'technical' service module
    - Technical service users need to see all companies to create requests

  2. Security
    - Only authenticated users with 'technical' in service_modules
    - Works for project_manager and operations roles
*/

-- Create new SELECT policy for technical module users
CREATE POLICY "Technical module users can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'technical' = ANY(profiles.service_modules)
    )
  );