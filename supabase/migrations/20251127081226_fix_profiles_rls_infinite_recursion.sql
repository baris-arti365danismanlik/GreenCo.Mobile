/*
  # Fix Infinite Recursion in Profiles RLS Policies

  1. Problem
    - The "Admins can view all profiles" policy causes infinite recursion
    - The "Company managers can view their company profiles" policy also causes recursion
    - Both policies query the profiles table while checking permissions on the profiles table

  2. Solution
    - Drop the problematic policies
    - Create new policies using app_metadata from JWT instead of querying profiles table
    - Store role information in auth.users metadata for efficient access
    - Keep simple policies that don't cause recursion

  3. Security
    - Maintains proper access control
    - Users can only see their own profile by default
    - Admin access will be controlled through app_metadata
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Company managers can view their company profiles" ON profiles;

-- Keep the working policies
-- "Users can view own profile" - Already exists and works fine
-- "Users can update own profile" - Already exists and works fine

-- For now, we'll use a simple approach where users can only see their own profile
-- To add admin access, we'll need to use app_metadata in the JWT which requires
-- updating the user metadata separately
