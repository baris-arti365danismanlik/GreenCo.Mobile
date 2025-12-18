/*
  # Add Service Modules to Profiles

  1. Changes
    - Add `service_modules` column to profiles table
    - Options: 'personnel', 'technical'
    - Users can have one or both modules

  2. Updates
    - Set all existing operations and project_managers to have 'personnel' module
    - Set all admins to have both modules

  3. Security
    - No RLS changes needed (already handled)

  4. Notes
    - Empty array means no module access
    - Admins always have full access
    - Operations and PM can be restricted to specific modules
*/

-- Add service_modules column if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'service_modules'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_modules TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Update existing users: Give personnel module to all operations and PMs
UPDATE profiles
SET service_modules = ARRAY['personnel']
WHERE role IN ('operations', 'project_manager')
AND (service_modules IS NULL OR service_modules = '{}');

-- Update existing admins: Give both modules
UPDATE profiles
SET service_modules = ARRAY['personnel', 'technical']
WHERE role = 'admin';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_service_modules ON profiles USING GIN (service_modules);
