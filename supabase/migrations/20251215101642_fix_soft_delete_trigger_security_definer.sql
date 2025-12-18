/*
  # Fix Soft Delete Trigger with SECURITY DEFINER

  ## Changes
  - Recreate the soft_delete_company_cascade function as SECURITY DEFINER
  - This allows the trigger to bypass RLS policies during cascade updates
  - Fixes the RLS error when soft deleting companies

  ## Security
  - Function runs with elevated privileges to update related records
  - Only triggered by admin users who have permission to soft delete companies
  - Trigger automatically handles cascade soft delete without RLS conflicts
*/

-- Drop existing function and recreate with SECURITY DEFINER
DROP FUNCTION IF EXISTS soft_delete_company_cascade() CASCADE;

CREATE OR REPLACE FUNCTION soft_delete_company_cascade()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Soft delete all profiles (users) belonging to this company
  UPDATE profiles 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all projects belonging to this company
  UPDATE projects_greenco 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all technical service requests
  UPDATE technical_service_requests 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all personnel
  UPDATE personnel 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all shifts
  UPDATE shifts 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all project requests
  UPDATE project_requests 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all authorized brands
  UPDATE company_authorized_brands 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_soft_delete_company_cascade ON companies;
CREATE TRIGGER trigger_soft_delete_company_cascade
  AFTER UPDATE OF deleted_at ON companies
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION soft_delete_company_cascade();
