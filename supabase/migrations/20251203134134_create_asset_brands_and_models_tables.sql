/*
  # Create Asset Brands and Models Tables

  1. New Tables
    - `asset_brands`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Brand name
      - `created_at` (timestamptz)
    
    - `asset_models`
      - `id` (uuid, primary key)
      - `brand_id` (uuid, foreign key to asset_brands)
      - `name` (text) - Model name
      - `created_at` (timestamptz)
      - Unique constraint on (brand_id, name)
    
  2. Updates to technical_service_requests
    - Add `brand_id` (uuid, nullable, foreign key to asset_brands)
    - Add `model_id` (uuid, nullable, foreign key to asset_models)
  
  3. Security
    - Enable RLS on both tables
    - Add policies for all authenticated users to read
    - Add policies for technical and admin roles to insert/update
    - Update technical_service_requests policies to allow brand/model updates
*/

-- Create asset_brands table
CREATE TABLE IF NOT EXISTS asset_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create asset_models table
CREATE TABLE IF NOT EXISTS asset_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES asset_brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_brand_model UNIQUE (brand_id, name)
);

-- Add brand and model to technical_service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'brand_id'
  ) THEN
    ALTER TABLE technical_service_requests ADD COLUMN brand_id uuid REFERENCES asset_brands(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'model_id'
  ) THEN
    ALTER TABLE technical_service_requests ADD COLUMN model_id uuid REFERENCES asset_models(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE asset_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_models ENABLE ROW LEVEL SECURITY;

-- Policies for asset_brands
CREATE POLICY "Everyone can view brands"
  ON asset_brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Technical and admin can insert brands"
  ON asset_brands FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' IN ('technical', 'admin')
  );

-- Policies for asset_models
CREATE POLICY "Everyone can view models"
  ON asset_models FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Technical and admin can insert models"
  ON asset_models FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' IN ('technical', 'admin')
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_models_brand_id ON asset_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_technical_requests_brand_id ON technical_service_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_technical_requests_model_id ON technical_service_requests(model_id);
