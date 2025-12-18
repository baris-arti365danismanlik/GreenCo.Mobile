/*
  # Add UPDATE policy for technical module users on bids
  
  1. Changes
    - Add policy allowing users with technical module to update bid status
    - This enables customers to accept/reject bids from the technical panel
  
  2. Security
    - Only users with "technical" in their service_modules can update
    - Users can update all bids (needed for customer decision flow)
*/

CREATE POLICY "Users with technical module can update bids"
  ON technical_service_bids
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' -> 'service_modules') @> '["technical"]'::jsonb
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' -> 'service_modules') @> '["technical"]'::jsonb
  );
