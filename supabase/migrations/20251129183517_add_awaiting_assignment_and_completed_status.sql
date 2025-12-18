/*
  # Add new status values to personnel_requests

  1. Changes
    - Drop existing status check constraint
    - Add new constraint with 'awaiting_assignment' and 'completed' status values
    - This allows proper tracking of request lifecycle:
      - pending: waiting for admin approval
      - awaiting_assignment: approved, waiting for personnel assignment
      - completed: all personnel assigned
      - rejected: request rejected

  2. Status Flow
    pending → awaiting_assignment → completed
    pending → rejected
*/

-- Drop old constraint
ALTER TABLE personnel_requests 
DROP CONSTRAINT IF EXISTS personnel_requests_status_check;

-- Add new constraint with additional status values
ALTER TABLE personnel_requests 
ADD CONSTRAINT personnel_requests_status_check 
CHECK (status IN ('pending', 'awaiting_assignment', 'completed', 'approved', 'rejected'));

-- Add completed_at column if not exists
ALTER TABLE personnel_requests 
ADD COLUMN IF NOT EXISTS completed_at timestamptz;
