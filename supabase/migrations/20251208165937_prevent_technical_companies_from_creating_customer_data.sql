/*
  # Prevent technical companies from creating customer-only data

  1. Problem
    - Technical companies should NEVER create:
      - Shifts (worker-specific data)
      - Personnel requests (customer company requests)
      - Timesheet periods (operations/admin only)
    - Technical companies can only VIEW and BID on technical service requests, not create them

  2. Changes
    - Remove/restrict INSERT policies for technical companies on these tables
    - Add explicit blocks to prevent data creation
    - Ensure only appropriate roles can create these records

  3. Security
    - Technical companies: Can only view and bid on technical requests
    - Customers/Managers: Can create technical requests, personnel requests
    - Admin/Operations: Can create timesheets and manage all data
    - Workers: Can create shifts (attendance)
*/

-- ============================================================================
-- 1. SHIFTS - Only workers can create their own shifts
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Technical company users can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Anyone can insert shifts" ON shifts;

-- Create correct policy: Only workers/personnel can create shifts
CREATE POLICY "Only workers can create their own shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = worker_id
    AND (auth.jwt()->>'role') NOT IN ('technical_company', 'admin', 'operations', 'project_manager')
  );

-- ============================================================================
-- 2. TECHNICAL SERVICE REQUESTS - Only customers can create
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Technical companies can create requests" ON technical_service_requests;
DROP POLICY IF EXISTS "Anyone can create technical requests" ON technical_service_requests;

-- Recreate correct INSERT policies
CREATE POLICY "Project managers can create technical requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'project_manager'
    OR (auth.jwt()->>'service_modules')::jsonb ? 'technical'
  );

CREATE POLICY "Operations can create technical requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
  );

CREATE POLICY "Admin can create technical requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'admin'
  );

-- Technical companies can ONLY view (SELECT already restricted by existing policies)

-- ============================================================================
-- 3. PERSONNEL REQUESTS - Only customers can create
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Technical companies can create personnel requests" ON personnel_requests;
DROP POLICY IF EXISTS "Anyone can create personnel requests" ON personnel_requests;

-- Recreate correct INSERT policies
CREATE POLICY "Project managers can create personnel requests"
  ON personnel_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'project_manager'
  );

CREATE POLICY "Operations can create personnel requests"
  ON personnel_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
  );

CREATE POLICY "Admin can create personnel requests"
  ON personnel_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- 4. TIMESHEET PERIODS - Only operations/admin can create
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Technical companies can create timesheets" ON timesheet_periods;
DROP POLICY IF EXISTS "Anyone can create timesheets" ON timesheet_periods;
DROP POLICY IF EXISTS "Project managers can create timesheets" ON timesheet_periods;

-- Recreate correct INSERT policies
CREATE POLICY "Operations can create timesheet periods"
  ON timesheet_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
  );

CREATE POLICY "Admin can create timesheet periods"
  ON timesheet_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'admin'
  );

-- ============================================================================
-- 5. INVOICES - Only operations/admin can create
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Technical companies can create invoices" ON invoices;
DROP POLICY IF EXISTS "Anyone can create invoices" ON invoices;

-- Recreate correct INSERT policies (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invoices' 
    AND policyname = 'Operations can create invoices'
  ) THEN
    CREATE POLICY "Operations can create invoices"
      ON invoices FOR INSERT
      TO authenticated
      WITH CHECK (
        (auth.jwt()->>'role') = 'operations'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'invoices' 
    AND policyname = 'Admin can create invoices'
  ) THEN
    CREATE POLICY "Admin can create invoices"
      ON invoices FOR INSERT
      TO authenticated
      WITH CHECK (
        (auth.jwt()->>'role') = 'admin'
      );
  END IF;
END $$;
