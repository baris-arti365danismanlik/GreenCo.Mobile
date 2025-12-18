/*
  # Fix Project Manager Personnel View Without Recursion

  1. Problem
    - Previous policy queries project_managers table
    - project_managers RLS might trigger profiles lookup = potential recursion

  2. Solution  
    - Drop the problematic policy
    - Project managers will handle this in application layer
    - They fetch personnel_ids first, then query profiles with .in()
    - The .in() query with specific IDs won't trigger recursive RLS

  3. Note
    - This is the safest approach
    - Application handles the logic, database just checks ownership
*/

-- Drop the policy that could cause recursion
DROP POLICY IF EXISTS "project_managers_view_assigned_personnel" ON profiles;

-- We rely on application layer to:
-- 1. Get project_assignments for manager's projects  
-- 2. Extract personnel_ids
-- 3. Query profiles.in(personnel_ids)
-- The .in() query is direct and won't recurse
