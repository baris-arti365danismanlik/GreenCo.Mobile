/*
  # Add Admin DELETE Policy for Profiles Table

  1. Problem
    - Profiles table has NO DELETE policy
    - No one can delete users, including admins
    - User management delete button does not work
    
  2. Changes
    - Add DELETE policy for admin role only
    - Allow admins to delete any profile (except technical company profiles)
    
  3. Security
    - Only admin role can delete profiles
    - Uses JWT metadata to check role
    - Cannot delete technical company users (they should be managed separately)
*/

-- Create DELETE policy for admins
CREATE POLICY "Admin can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'admin'
    AND technical_company_id IS NULL
  );
