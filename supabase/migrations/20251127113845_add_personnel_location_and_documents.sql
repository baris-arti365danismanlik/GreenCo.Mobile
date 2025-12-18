/*
  # Add City, District, and Document Types to Personnel

  1. Changes
    - Add `city` column to personnel table (text, nullable)
    - Add `district` column to personnel table (text, nullable)
    - Add `document_types` column to personnel table (text array, nullable)
    - Add `project_status` enum type for projects
    - Add `status` column to projects_greenco table

  2. Security
    - No RLS changes needed as personnel table already has RLS enabled
*/

-- Add city and district columns to personnel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel' AND column_name = 'city'
  ) THEN
    ALTER TABLE personnel ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel' AND column_name = 'district'
  ) THEN
    ALTER TABLE personnel ADD COLUMN district text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel' AND column_name = 'document_types'
  ) THEN
    ALTER TABLE personnel ADD COLUMN document_types text[];
  END IF;
END $$;

-- Create project status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('pending_approval', 'active', 'completed');
  END IF;
END $$;

-- Add status column to projects_greenco
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects_greenco' AND column_name = 'status'
  ) THEN
    ALTER TABLE projects_greenco ADD COLUMN status project_status DEFAULT 'pending_approval';
  END IF;
END $$;