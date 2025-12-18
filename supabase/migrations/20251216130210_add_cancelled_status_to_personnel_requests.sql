/*
  # Add cancelled status to personnel requests

  1. Changes
    - Add 'cancelled' to status check constraint
    - Add cancelled_at timestamp column
    - Add cancelled_by user reference column
  
  2. Security
    - No RLS changes needed, existing policies apply
*/

-- Drop existing constraint and add new one with cancelled status
ALTER TABLE personnel_requests DROP CONSTRAINT IF EXISTS personnel_requests_status_check;
ALTER TABLE personnel_requests ADD CONSTRAINT personnel_requests_status_check 
  CHECK (status IN ('pending', 'awaiting_assignment', 'completed', 'approved', 'rejected', 'cancelled'));

-- Add cancelled_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel_requests' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE personnel_requests ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

-- Add cancelled_by column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel_requests' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE personnel_requests ADD COLUMN cancelled_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;