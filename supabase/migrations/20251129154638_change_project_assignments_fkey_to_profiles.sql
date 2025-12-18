/*
  # Change project_assignments foreign key to profiles

  1. Changes
    - Drop existing foreign key constraint on project_assignments.personnel_id
    - Add new foreign key constraint pointing to profiles.id
    - This allows assigning personnel using their profile IDs directly
  
  2. Reason
    - System uses profiles table for personnel management
    - Personnel table is optional/supplementary
    - Assignments should work with profile IDs
*/

-- Drop old foreign key
ALTER TABLE project_assignments 
DROP CONSTRAINT IF EXISTS project_assignments_personnel_id_fkey;

-- Add new foreign key to profiles
ALTER TABLE project_assignments 
ADD CONSTRAINT project_assignments_personnel_id_fkey 
FOREIGN KEY (personnel_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;
