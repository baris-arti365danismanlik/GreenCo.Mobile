/*
  # Fix Asset Brands Unique Constraint

  1. Changes
    - Remove unique constraint on `name` column alone
    - Add unique constraint on combination of `name` and `service_type_id`
    - This allows same brand to exist for different service types
    
  2. Notes
    - Daikin can now exist for both Klima and HVAC service types
    - Each brand-service_type combination remains unique
*/

-- Drop the old unique constraint on name only
ALTER TABLE asset_brands DROP CONSTRAINT IF EXISTS asset_brands_name_key;

-- Add unique constraint on the combination of name and service_type_id
ALTER TABLE asset_brands ADD CONSTRAINT asset_brands_name_service_type_key 
  UNIQUE (name, service_type_id);
