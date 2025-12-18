/*
  # Create Company Authorized Brands Table

  1. New Tables
    - `company_authorized_brands`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `service_type_id` (uuid, references technical_service_types)
      - `brand_id` (uuid, references asset_brands)
      - `created_at` (timestamptz)
      - Unique constraint on (company_id, brand_id) to prevent duplicates

  2. Security
    - Enable RLS on `company_authorized_brands` table
    - Admin can perform all operations
    - Operations can view all authorized brands
    - Technical users can view all authorized brands (for finding authorized services)
    - Project managers can view all authorized brands

  3. Purpose
    - Track which brands each company is an authorized service provider for
    - Used when filtering companies for "authorized service" requests
    - Allows multi-brand selection per company per service type
*/

CREATE TABLE IF NOT EXISTS company_authorized_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES technical_service_types(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES asset_brands(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, brand_id)
);

-- Enable RLS
ALTER TABLE company_authorized_brands ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin can manage company authorized brands"
  ON company_authorized_brands
  FOR ALL
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Operations, Technical, and Project Managers can view
CREATE POLICY "Operations can view company authorized brands"
  ON company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

CREATE POLICY "Technical can view company authorized brands"
  ON company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical');

CREATE POLICY "Project managers can view company authorized brands"
  ON company_authorized_brands
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_authorized_brands_company_id ON company_authorized_brands(company_id);
CREATE INDEX IF NOT EXISTS idx_company_authorized_brands_service_type_id ON company_authorized_brands(service_type_id);
CREATE INDEX IF NOT EXISTS idx_company_authorized_brands_brand_id ON company_authorized_brands(brand_id);
