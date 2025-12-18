/*
  # Add Relational Filters to Asset Brands

  1. Changes to `asset_brands`
    - Add `service_type_id` column to link brands to specific service types
    - Add foreign key constraint to `technical_service_types` table
    - Only brands related to a specific service type should appear in that module

  2. Security
    - Update RLS policies to maintain existing access patterns
*/

-- Add service_type_id to asset_brands
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asset_brands' AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE asset_brands 
    ADD COLUMN service_type_id uuid REFERENCES technical_service_types(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_brands_service_type_id ON asset_brands(service_type_id);