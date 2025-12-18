/*
  # Add Performance Notes to Attendance Records

  1. Changes
    - Add `performance_notes` column to `attendance_records` table
      - Text field for manager comments on personnel performance
      - Nullable field
      - Can be updated by managers during daily attendance review or timesheet approval
  
  2. Purpose
    - Allow project managers to leave performance feedback for personnel
    - Store comments alongside performance ratings
    - Help track qualitative performance data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'performance_notes'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN performance_notes text;
  END IF;
END $$;
