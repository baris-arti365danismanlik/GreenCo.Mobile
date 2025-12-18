/*
  # Add is_tech_service_company column to companies table

  1. Changes
    - Add `is_tech_service_company` boolean column to companies table
    - Default value is false
    - Mark technical service companies based on their names
  
  2. Purpose
    - Distinguish technical service companies from regular companies
    - Prevent users from being assigned to technical service companies in user management
    - Only regular companies (construction/project companies) should appear in user assignment dropdowns
*/

-- Add the column
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS is_tech_service_company boolean DEFAULT false;

-- Mark companies that are technical service providers based on name patterns
UPDATE companies
SET is_tech_service_company = true
WHERE 
  name LIKE '%Teknik%' 
  OR name LIKE '%Servis%'
  OR name LIKE '%Asansör%'
  OR name LIKE '%İklim%'
  OR name LIKE '%HVAC%'
  OR name LIKE '%Soğutma%'
  OR name LIKE '%Elektronik%'
  OR name LIKE '%Mutfak%'
  OR name LIKE '%Temizlik%'
  OR name LIKE '%Hijyen%'
  OR name LIKE '%Tadilat%'
  OR name LIKE '%Dekorasyon%'
  OR name LIKE '%Tesisat%'
  OR name LIKE '%Enerji%'
  OR name LIKE '%Kapı%Pencere%'
  OR name LIKE '%Teknolojiler%';
