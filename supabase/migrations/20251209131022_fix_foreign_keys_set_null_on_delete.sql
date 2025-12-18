/*
  # Fix Foreign Key Constraints - Change NO ACTION to SET NULL

  1. Changes
    - Update all profile foreign key constraints from NO ACTION to SET NULL ON DELETE
    - This allows users to be deleted while preserving audit trail records
    - NULL values indicate the user no longer exists in the system

  2. Affected Tables
    - invoices (created_by, approved_by)
    - personnel_requests (approved_by)
    - project_assignments (worker_id)
    - project_requests (requested_by)
    - technical_service_assignments (pm_approved_by, operations_approved_by)
    - technical_service_invoices (created_by, approved_by, rejected_by)
    - technical_service_requests (created_by)
    - technical_service_reviews (reviewed_by)
    - timesheet_periods (initiated_by, manager_approved_by, invoice_created_by)

  3. Important Notes
    - Columns are already nullable, so no schema changes needed
    - When a user is deleted, their references become NULL
    - Audit records remain intact
*/

-- Drop and recreate foreign key constraints with SET NULL ON DELETE

-- invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_approved_by_fkey;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE invoices 
  ADD CONSTRAINT invoices_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- personnel_requests
ALTER TABLE personnel_requests DROP CONSTRAINT IF EXISTS personnel_requests_approved_by_fkey;

ALTER TABLE personnel_requests 
  ADD CONSTRAINT personnel_requests_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- project_assignments
ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_worker_id_fkey;

ALTER TABLE project_assignments 
  ADD CONSTRAINT project_assignments_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- project_requests
ALTER TABLE project_requests DROP CONSTRAINT IF EXISTS project_requests_requested_by_fkey;

ALTER TABLE project_requests 
  ADD CONSTRAINT project_requests_requested_by_fkey 
  FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- technical_service_assignments
ALTER TABLE technical_service_assignments DROP CONSTRAINT IF EXISTS technical_service_assignments_pm_approved_by_fkey;
ALTER TABLE technical_service_assignments DROP CONSTRAINT IF EXISTS technical_service_assignments_operations_approved_by_fkey;

ALTER TABLE technical_service_assignments 
  ADD CONSTRAINT technical_service_assignments_pm_approved_by_fkey 
  FOREIGN KEY (pm_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE technical_service_assignments 
  ADD CONSTRAINT technical_service_assignments_operations_approved_by_fkey 
  FOREIGN KEY (operations_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- technical_service_invoices
ALTER TABLE technical_service_invoices DROP CONSTRAINT IF EXISTS technical_service_invoices_created_by_fkey;
ALTER TABLE technical_service_invoices DROP CONSTRAINT IF EXISTS technical_service_invoices_approved_by_fkey;
ALTER TABLE technical_service_invoices DROP CONSTRAINT IF EXISTS technical_service_invoices_rejected_by_fkey;

ALTER TABLE technical_service_invoices 
  ADD CONSTRAINT technical_service_invoices_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE technical_service_invoices 
  ADD CONSTRAINT technical_service_invoices_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE technical_service_invoices 
  ADD CONSTRAINT technical_service_invoices_rejected_by_fkey 
  FOREIGN KEY (rejected_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- technical_service_requests
ALTER TABLE technical_service_requests DROP CONSTRAINT IF EXISTS technical_service_requests_created_by_fkey;

ALTER TABLE technical_service_requests 
  ADD CONSTRAINT technical_service_requests_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- technical_service_reviews
ALTER TABLE technical_service_reviews DROP CONSTRAINT IF EXISTS technical_service_reviews_reviewed_by_fkey;

ALTER TABLE technical_service_reviews 
  ADD CONSTRAINT technical_service_reviews_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- timesheet_periods
ALTER TABLE timesheet_periods DROP CONSTRAINT IF EXISTS timesheet_periods_initiated_by_fkey;
ALTER TABLE timesheet_periods DROP CONSTRAINT IF EXISTS timesheet_periods_manager_approved_by_fkey;
ALTER TABLE timesheet_periods DROP CONSTRAINT IF EXISTS timesheet_periods_invoice_created_by_fkey;

ALTER TABLE timesheet_periods 
  ADD CONSTRAINT timesheet_periods_initiated_by_fkey 
  FOREIGN KEY (initiated_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE timesheet_periods 
  ADD CONSTRAINT timesheet_periods_manager_approved_by_fkey 
  FOREIGN KEY (manager_approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE timesheet_periods 
  ADD CONSTRAINT timesheet_periods_invoice_created_by_fkey 
  FOREIGN KEY (invoice_created_by) REFERENCES profiles(id) ON DELETE SET NULL;
