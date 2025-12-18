/*
  # Update existing users with role in JWT metadata

  1. Purpose
    - Add role to app_metadata for all existing users
    - This fixes the RLS infinite recursion issue
    - Required for the new RLS policy to work correctly

  2. Changes
    - Update auth.users table to include role in app_metadata
    - This allows RLS policies to check role without querying profiles table
*/

-- Update all existing users to have their role in app_metadata
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT id, role FROM profiles
  LOOP
    -- Update the auth.users table with role in app_metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(profile_record.role)
      ),
      updated_at = now()
    WHERE id = profile_record.id;
  END LOOP;
END $$;
