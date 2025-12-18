/*
  # Sync Company ID to JWT Metadata

  ## Issue
  Operations and project_manager users need company_id in JWT for RLS policies.
  Currently company_id exists in profiles but not in auth.users metadata.

  ## Solution
  Update raw_app_meta_data to include company_id for all users that have it.

  ## Changes
  - Add company_id to app_metadata for operations users
  - Add company_id to app_metadata for project_manager users
  - Users without company_id keep null
*/

-- Update operations users with company_id
UPDATE auth.users au
SET raw_app_meta_data = au.raw_app_meta_data || jsonb_build_object('company_id', p.company_id::text)
FROM profiles p
WHERE p.id = au.id
  AND p.role = 'operations'
  AND p.company_id IS NOT NULL;

-- Update project_manager users with company_id
UPDATE auth.users au
SET raw_app_meta_data = au.raw_app_meta_data || jsonb_build_object('company_id', p.company_id::text)
FROM profiles p
WHERE p.id = au.id
  AND p.role = 'project_manager'
  AND p.company_id IS NOT NULL;
