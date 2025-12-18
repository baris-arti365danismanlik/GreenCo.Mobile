/*
  # Fix NOT NULL Columns with SET NULL ON DELETE

  1. Problem
    - Some columns have NOT NULL constraint but SET NULL ON DELETE foreign key rule
    - This creates a conflict when deleting referenced users
    - Database cannot set NULL on NOT NULL columns

  2. Solution
    - Make these columns nullable to allow SET NULL ON DELETE to work properly
    - Affected columns:
      * invoices.created_by
      * project_requests.requested_by
      * technical_service_invoices.created_by
      * timesheet_periods.initiated_by

  3. Impact
    - Users can now be deleted without constraint violations
    - Audit records remain but creator/initiator references become NULL
*/

-- Make columns nullable
ALTER TABLE invoices 
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE project_requests 
  ALTER COLUMN requested_by DROP NOT NULL;

ALTER TABLE technical_service_invoices 
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE timesheet_periods 
  ALTER COLUMN initiated_by DROP NOT NULL;
