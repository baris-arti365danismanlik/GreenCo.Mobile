/*
  # Add city and district columns to projects_greenco

  1. Changes
    - Add `city` column to `projects_greenco` table (nullable)
    - Add `district` column to `projects_greenco` table (nullable)
  
  2. Notes
    - These columns store the location information for projects
    - Nullable because existing projects may not have this data
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects_greenco' AND column_name = 'city'
  ) THEN
    ALTER TABLE projects_greenco ADD COLUMN city text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects_greenco' AND column_name = 'district'
  ) THEN
    ALTER TABLE projects_greenco ADD COLUMN district text;
  END IF;
END $$;
