/*
  # Sync Technical Company IDs to Profiles

  1. Purpose
    - Update profiles table with technical_company_id from JWT metadata
    - Fix missing technical_company_id in existing technical company user profiles

  2. Changes
    - Update profiles where role = 'technical_company' and technical_company_id is null
    - Sync from auth.users app_metadata

  3. Notes
    - This is a data migration to fix existing records
    - New users will have this set automatically via the edge function
*/

DO $$
DECLARE
  user_record RECORD;
  tech_company_id uuid;
BEGIN
  FOR user_record IN 
    SELECT id, raw_app_meta_data
    FROM auth.users
    WHERE (raw_app_meta_data->>'role') = 'technical_company'
  LOOP
    -- Extract technical_company_id from app_metadata
    tech_company_id := (user_record.raw_app_meta_data->>'technical_company_id')::uuid;
    
    IF tech_company_id IS NOT NULL THEN
      -- Update profile with technical_company_id
      UPDATE profiles
      SET technical_company_id = tech_company_id,
          role = 'technical_company'
      WHERE id = user_record.id
        AND (technical_company_id IS NULL OR technical_company_id != tech_company_id);
      
      RAISE NOTICE 'Updated profile for user %: technical_company_id = %', user_record.id, tech_company_id;
    END IF;
  END LOOP;
END $$;
