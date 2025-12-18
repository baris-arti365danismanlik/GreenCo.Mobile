/*
  # Allow technical companies to create assignments

  1. Changes
    - Add INSERT policy for technical companies to create assignments from accepted bids
    
  2. Security
    - Only technical companies with matching company_id can create assignments
    - Ensures companies can only create assignments for their own company
*/

CREATE POLICY "Technical companies can create their assignments"
  ON technical_service_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company')
    AND (company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid))
  );
