/*
  # Fix project_assignments table - Add missing worker_id column

  1. Changes
    - Add worker_id column to project_assignments table
    - This column references profiles(id) for the assigned worker
    - Set as nullable since existing records may not have workers assigned
  
  2. Notes
    - This fixes the error: column project_assignments.worker_id does not exist
    - Existing queries expect this column to exist
*/

-- Add worker_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_assignments' 
    AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE project_assignments 
      ADD COLUMN worker_id uuid REFERENCES profiles(id);
    
    CREATE INDEX IF NOT EXISTS idx_project_assignments_worker_id 
      ON project_assignments(worker_id);
  END IF;
END $$;
