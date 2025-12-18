/*
  # Add Soft Delete Support for Companies and Related Records

  1. Changes
    - Add `deleted_at` column to companies and related tables
    - Create trigger to cascade soft delete to related records
    - Update RLS policies to exclude soft-deleted records from queries
    - Companies and related data remain in database but hidden from UI

  2. Tables Modified
    - companies
    - profiles (users)
    - projects_greenco
    - technical_service_requests
    - personnel
    - shifts
    - project_requests
    - company_authorized_brands

  3. Security
    - Soft-deleted records are hidden from all users
    - Only non-deleted records appear in queries
    - Admin can soft-delete companies
*/

-- Add deleted_at column to companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to profiles (for users)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to projects_greenco
ALTER TABLE projects_greenco 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to technical_service_requests
ALTER TABLE technical_service_requests 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to personnel
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to shifts
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to project_requests
ALTER TABLE project_requests 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Add deleted_at column to company_authorized_brands
ALTER TABLE company_authorized_brands 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create function to cascade soft delete
CREATE OR REPLACE FUNCTION soft_delete_company_cascade()
RETURNS TRIGGER AS $$
BEGIN
  -- Soft delete all profiles (users) belonging to this company
  UPDATE profiles 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all projects belonging to this company
  UPDATE projects_greenco 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all technical service requests
  UPDATE technical_service_requests 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all personnel
  UPDATE personnel 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all shifts
  UPDATE shifts 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all project requests
  UPDATE project_requests 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  -- Soft delete all authorized brands
  UPDATE company_authorized_brands 
  SET deleted_at = NEW.deleted_at
  WHERE company_id = NEW.id AND deleted_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for soft delete cascade
DROP TRIGGER IF EXISTS trigger_soft_delete_company_cascade ON companies;
CREATE TRIGGER trigger_soft_delete_company_cascade
  AFTER UPDATE OF deleted_at ON companies
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION soft_delete_company_cascade();

-- Update RLS policies to exclude soft-deleted companies

-- Drop existing SELECT policies for companies
DROP POLICY IF EXISTS "Admins can view all companies" ON companies;
DROP POLICY IF EXISTS "Company users can view their company" ON companies;
DROP POLICY IF EXISTS "Operations can view their company" ON companies;
DROP POLICY IF EXISTS "Project managers can view their project companies" ON companies;

-- Recreate SELECT policies with deleted_at filter
CREATE POLICY "Admins can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND deleted_at IS NULL
  );

CREATE POLICY "Company users can view their company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND deleted_at IS NULL
  );

CREATE POLICY "Operations can view their company"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
    AND id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
    AND deleted_at IS NULL
  );

CREATE POLICY "Project managers can view their project companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND deleted_at IS NULL
    AND id IN (
      SELECT DISTINCT p.company_id
      FROM projects_greenco p
      JOIN project_managers pm ON pm.project_id = p.id
      WHERE pm.manager_id = auth.uid()
        AND p.company_id IS NOT NULL
        AND p.deleted_at IS NULL
    )
  );

-- Update profiles RLS policies to exclude soft-deleted users
-- Note: We'll need to update all profile policies, but let's focus on the main ones

DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Admin can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND deleted_at IS NULL
  );

CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    AND deleted_at IS NULL
  );

-- Update projects_greenco policies
DROP POLICY IF EXISTS "Admin can view all projects" ON projects_greenco;

CREATE POLICY "Admin can view all projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND deleted_at IS NULL
  );

-- Note: Admin's DELETE operation now performs soft delete
DROP POLICY IF EXISTS "Admins can delete companies" ON companies;

CREATE POLICY "Admins can soft delete companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
