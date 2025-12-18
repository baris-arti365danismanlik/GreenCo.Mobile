/*
  # Sync Service Modules to JWT Metadata

  ## Problem
  The `service_modules` field exists in profiles table but is not synced to JWT metadata.
  RLS policies checking JWT metadata for service_modules fail because the data isn't there.

  ## Solution
  1. Update all existing users' JWT metadata with their service_modules
  2. Create a trigger to auto-sync when service_modules changes

  ## Changes
  - Update auth.users.raw_app_meta_data for all users with service_modules
  - Create trigger function to sync service_modules on profile updates
  - Create trigger on profiles table
*/

-- Update all existing users' JWT metadata with service_modules
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object('service_modules', p.service_modules)
FROM profiles p
WHERE auth.users.id = p.id
  AND p.service_modules IS NOT NULL
  AND p.service_modules != '{}';

-- Create function to sync service_modules to JWT metadata
CREATE OR REPLACE FUNCTION sync_service_modules_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's JWT metadata with service_modules
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('service_modules', NEW.service_modules)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS sync_service_modules_trigger ON profiles;

-- Create trigger to auto-sync service_modules
CREATE TRIGGER sync_service_modules_trigger
  AFTER INSERT OR UPDATE OF service_modules ON profiles
  FOR EACH ROW
  WHEN (NEW.service_modules IS NOT NULL)
  EXECUTE FUNCTION sync_service_modules_to_jwt();
