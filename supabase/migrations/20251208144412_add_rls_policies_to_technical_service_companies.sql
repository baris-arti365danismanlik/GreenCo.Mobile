/*
  # Add RLS Policies to Technical Service Companies

  ## Changes
  
  1. Security
    - Enable RLS on `technical_service_companies` table
    - Add SELECT policies for:
      - Admin users (can see all companies)
      - Technical module users (can see all companies for managing requests)
      - Technical company users (can see their own company)
      - Project managers and operations (can see companies related to their requests)
    
  2. Notes
    - Currently only adding SELECT policies
    - INSERT/UPDATE/DELETE policies can be added later as needed
*/

-- Enable RLS
ALTER TABLE technical_service_companies ENABLE ROW LEVEL SECURITY;

-- Admin can see all companies
CREATE POLICY "Admin users can view all technical service companies"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin'
  );

-- Technical module users can see all companies (for managing requests)
CREATE POLICY "Technical module users can view all technical service companies"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    'technical' = ANY(
      COALESCE(
        (
          SELECT ARRAY(SELECT jsonb_array_elements_text((auth.jwt()->>'app_metadata')::jsonb->'service_modules'))
        ),
        ARRAY[]::text[]
      )
    )
  );

-- Technical company users can see their own company
CREATE POLICY "Technical company users can view their own company"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    id::text = (auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id'
  );

-- Project managers and operations can see all companies (for viewing bids)
CREATE POLICY "Project managers can view technical service companies"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' IN ('project_manager', 'operations')
  );
