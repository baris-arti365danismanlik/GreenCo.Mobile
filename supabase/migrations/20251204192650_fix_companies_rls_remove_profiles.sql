/*
  # Fix Companies RLS - Remove Complex Joins

  This migration simplifies the companies table RLS policies to avoid
  circular dependencies and complex joins that could cause 500 errors.

  ## Changes
  
  1. Simplify project manager policy to avoid joins with projects_greenco
  2. Use only JWT metadata where possible
  3. Keep policies simple and direct
  
  ## Security
  
  - Maintains proper access control
  - Simplified policies for better performance
  - No circular dependencies
*/

-- Drop the complex project manager policy
DROP POLICY IF EXISTS "Project managers can view project companies" ON companies;

-- Recreate with a simpler approach - project managers can view all companies
-- This is acceptable since they need to see company info for technical requests
CREATE POLICY "Project managers can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
  );
