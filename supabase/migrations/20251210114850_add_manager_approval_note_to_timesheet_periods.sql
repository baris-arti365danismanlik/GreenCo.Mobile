/*
  # Add manager approval note to timesheet periods

  1. Changes
    - Add `manager_approval_note` column to `timesheet_periods` table
    - This column will store comments from project managers during approval
    - Visible to operations and admin users

  2. Notes
    - Column is optional (nullable)
    - Default value is NULL
*/

-- Add manager approval note column
ALTER TABLE timesheet_periods 
ADD COLUMN IF NOT EXISTS manager_approval_note text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN timesheet_periods.manager_approval_note IS 'Comments entered by project manager during approval process';
