/*
  # Fix Project Manager Access to Lookups
  
  1. Purpose
    - Ensure 'project_manager' role can access:
      - technical_service_types
      - asset_brands
      - asset_models
      - companies
  
  2. Changes
    - Add/Ensure SELECT policies for 'project_manager' on these tables.
*/

-- 1. Technical Service Types
DO $$ BEGIN
  DROP POLICY IF EXISTS "PMs can view service types" ON technical_service_types;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "PMs can view service types"
  ON technical_service_types FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );

-- 2. Asset Brands
DO $$ BEGIN
  DROP POLICY IF EXISTS "PMs can view asset brands" ON asset_brands;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "PMs can view asset brands"
  ON asset_brands FOR SELECT
  TO authenticated
  USING (true); -- Open to all authenticated users like technicians

-- 3. Asset Models
DO $$ BEGIN
  DROP POLICY IF EXISTS "PMs can view asset models" ON asset_models;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "PMs can view asset models"
  ON asset_models FOR SELECT
  TO authenticated
  USING (true); -- Open to all authenticated users like technicians
