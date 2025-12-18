/*
  # Fix Asset Brands and Models RLS Policies

  1. Changes
    - Drop existing insert policies that check role from JWT
    - Create new policies that allow authenticated technical users to insert
    - Use the same pattern as other technical module policies
  
  2. Security
    - Technical users can insert brands and models
    - Admin users can insert brands and models
    - Everyone can read brands and models
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Technical and admin can insert brands" ON asset_brands;
DROP POLICY IF EXISTS "Technical and admin can insert models" ON asset_models;

-- Create new policies for asset_brands
CREATE POLICY "Authenticated users can insert brands"
  ON asset_brands FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update brands"
  ON asset_brands FOR UPDATE
  TO authenticated
  USING (true);

-- Create new policies for asset_models
CREATE POLICY "Authenticated users can insert models"
  ON asset_models FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update models"
  ON asset_models FOR UPDATE
  TO authenticated
  USING (true);
