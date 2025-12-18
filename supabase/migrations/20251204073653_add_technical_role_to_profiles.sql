/*
  # Add Technical Role to Profiles
  
  1. Changes
    - Update profiles table role constraint to include 'technical' role
    - Technical users represent external service company representatives
  
  2. Security
    - No RLS changes needed, existing policies will handle technical role
*/

-- Drop existing role constraint
ALTER TABLE profiles 
  DROP CONSTRAINT profiles_role_check;

-- Add new constraint with technical role
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('personnel', 'project_manager', 'operations', 'admin', 'technical'));
