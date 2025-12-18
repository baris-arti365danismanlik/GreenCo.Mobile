/*
  # Simplify Profiles RLS - Remove All Table References

  1. Problem
    - profiles policies reference project_managers table
    - project_managers policies reference profiles table
    - Even subqueries cause infinite recursion during RLS evaluation

  2. Solution
    - Remove ALL policies that reference other tables
    - Keep only simple JWT-based and auth.uid() based policies
    - For project manager personnel view, we'll handle this in application code

  3. Changes
    - Drop problematic policies that query other tables
    - Keep simple policies: own profile, admin view all, operations view managers
*/

-- Drop the problematic policy that references project_managers table
DROP POLICY IF EXISTS "project_managers_can_view_assigned_personnel" ON profiles;

-- That's it! Now profiles only has policies that use:
-- 1. auth.uid() = id (own profile)
-- 2. JWT role checks (no table queries)
-- 3. Simple role column checks (no joins)

-- Project managers will need to fetch their assigned personnel through
-- the project_assignments table in the application layer
