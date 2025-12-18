/*
  # Add technical_company role to profiles

  1. Changes
    - Add 'technical_company' to the allowed values in profiles.role check constraint
    - This role is for external technical service company users who can:
      - View and bid on service requests
      - Manage their active jobs
      - Update their company profile
      - Submit job completion reports

  2. Security
    - Existing RLS policies will be updated to handle technical_company role appropriately
*/

-- Drop existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with technical_company role
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY[
    'personnel'::text, 
    'project_manager'::text, 
    'operations'::text, 
    'admin'::text, 
    'technical'::text,
    'technical_company'::text
  ]));
