/*
  # Add location fields to personnel_requests table

  1. Changes
    - Add `city` column to personnel_requests
    - Add `district` column to personnel_requests
    - These will store the project location for new projects

  2. Notes
    - Only used for new project requests (is_new_project = true)
    - Existing requests will have NULL values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel_requests' AND column_name = 'city'
  ) THEN
    ALTER TABLE personnel_requests ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel_requests' AND column_name = 'district'
  ) THEN
    ALTER TABLE personnel_requests ADD COLUMN district text;
  END IF;
END $$;
