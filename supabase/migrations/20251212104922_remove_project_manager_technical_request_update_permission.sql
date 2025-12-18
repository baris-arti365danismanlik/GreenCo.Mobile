/*
  # Remove Project Manager Technical Request Update Permission

  ## Summary
  
  This migration removes the UPDATE permission for project managers on technical_service_requests table.
  Project managers should only be able to VIEW requests and their status, not approve or modify bids.
  Only Operations role should have the authority to accept bids and update request status.

  ## Changes
  
  1. Drop existing project manager UPDATE policy
  2. Keep SELECT policy for viewing
  3. Keep INSERT policy for creating new requests
  
  ## Security
  
  - Project managers can still view their project's technical requests
  - Project managers can still create new technical requests
  - Project managers CANNOT update request status or select bids
  - Only Operations and Admin can update technical requests
*/

-- Drop the project manager UPDATE policy
DROP POLICY IF EXISTS "Project managers can update assigned project requests" ON technical_service_requests;

-- The SELECT and INSERT policies remain unchanged for project managers
-- They can still view and create requests, just not update them