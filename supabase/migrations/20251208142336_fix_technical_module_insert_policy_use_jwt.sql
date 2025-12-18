/*
  # Fix Technical Module INSERT Policy to Use JWT

  ## Problem
  The "Users with technical module can create requests" policy uses:
  ```
  auth.uid() IN (SELECT profiles.id FROM profiles WHERE profiles.service_modules @> ARRAY['technical'])
  ```
  
  This creates a circular dependency with profiles table and doesn't work.

  ## Solution
  Replace with JWT metadata check like other policies:
  ```
  (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  ```

  ## Security
  - Same access control
  - No circular dependencies
  - Consistent with other technical module policies
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users with technical module can create requests" ON technical_service_requests;

-- Recreate with JWT metadata check
CREATE POLICY "Users with technical module can create requests"
  ON technical_service_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' -> 'service_modules')::jsonb @> '["technical"]'::jsonb
  );
