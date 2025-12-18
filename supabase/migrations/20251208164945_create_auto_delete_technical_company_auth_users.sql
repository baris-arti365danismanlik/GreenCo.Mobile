/*
  # Auto-delete technical company auth users when company is deleted

  1. Changes
    - Creates a trigger function that deletes auth users when technical_service_companies record is deleted
    - The function finds the corresponding auth user by matching the company_id in profiles.technical_company_id
    - Creates a trigger that executes after DELETE on technical_service_companies

  2. Security
    - Function runs with SECURITY DEFINER to allow auth.users deletion
    - Only deletes users associated with the deleted company
*/

-- Create function to delete auth users when technical company is deleted
CREATE OR REPLACE FUNCTION delete_technical_company_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete all auth users that have this company_id in their profile
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM profiles
    WHERE technical_company_id = OLD.id
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger on technical_service_companies
DROP TRIGGER IF EXISTS on_technical_company_delete ON technical_service_companies;

CREATE TRIGGER on_technical_company_delete
  AFTER DELETE ON technical_service_companies
  FOR EACH ROW
  EXECUTE FUNCTION delete_technical_company_auth_user();
