/*
  # Create Technical Company Authorized Brands Table

  1. New Tables
    - `technical_company_authorized_brands`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references technical_service_companies)
      - `service_type_id` (uuid, references technical_service_types)
      - `brand_id` (uuid, references asset_brands)
      - `created_at` (timestamptz)
      - Unique constraint on (company_id, brand_id)

  2. Security
    - Enable RLS
    - Admin can manage all
    - Technical company users can view their own brands

  3. Purpose
    - Track which brands each technical service company is authorized for
    - Separate from regular companies table
*/

-- Create table
CREATE TABLE IF NOT EXISTS technical_company_authorized_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES technical_service_types(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES asset_brands(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, brand_id)
);

-- Enable RLS
ALTER TABLE technical_company_authorized_brands ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin can manage technical company authorized brands"
  ON technical_company_authorized_brands
  FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Technical company users can view their own
CREATE POLICY "Technical companies can view own authorized brands"
  ON technical_company_authorized_brands
  FOR SELECT
  TO authenticated
  USING (
    company_id = ((auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id')::uuid
  );

-- Operations, Technical, and Project Managers can view all
CREATE POLICY "Operations can view technical company authorized brands"
  ON technical_company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

CREATE POLICY "Technical can view technical company authorized brands"
  ON technical_company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical');

CREATE POLICY "Project managers can view technical company authorized brands"
  ON technical_company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tech_company_auth_brands_company_id 
  ON technical_company_authorized_brands(company_id);
CREATE INDEX IF NOT EXISTS idx_tech_company_auth_brands_service_type_id 
  ON technical_company_authorized_brands(service_type_id);
CREATE INDEX IF NOT EXISTS idx_tech_company_auth_brands_brand_id 
  ON technical_company_authorized_brands(brand_id);
