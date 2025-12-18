/*
  # Add RLS Policies for Technical Company Role

  1. Purpose
    - Grant technical_company role access to technical service tables
    - Allow technical companies to view requests assigned to them
    - Allow technical companies to create and manage bids
    - Allow technical companies to view and respond to info requests
    - Allow technical companies to view and update their assignments

  2. Tables Affected
    - technical_service_requests (SELECT)
    - technical_service_bids (SELECT, INSERT, UPDATE)
    - technical_service_info_requests (SELECT, INSERT, UPDATE)
    - technical_service_assignments (SELECT, UPDATE)
    - technical_service_companies (SELECT for own company)
    - technical_service_types (SELECT)
    - profiles (SELECT for own profile)

  3. Security
    - Technical companies can only see data relevant to them
    - Cannot see other companies' bids
    - Can only update their own data
*/

-- Technical Service Companies: Can view their own company
CREATE POLICY "Technical companies can view their own company"
  ON technical_service_companies FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Requests: Can view all active requests
CREATE POLICY "Technical companies can view all service requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND status IN ('pending_review', 'info_needed', 'bidding', 'approved', 'in_progress')
  );

-- Technical Service Bids: Can view own bids
CREATE POLICY "Technical companies can view their own bids"
  ON technical_service_bids FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Bids: Can create bids
CREATE POLICY "Technical companies can create bids"
  ON technical_service_bids FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Bids: Can update own bids
CREATE POLICY "Technical companies can update their own bids"
  ON technical_service_bids FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Info Requests: Can view info requests for their requests
CREATE POLICY "Technical companies can view their info requests"
  ON technical_service_info_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND requested_by_company IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Info Requests: Can create info requests
CREATE POLICY "Technical companies can create info requests"
  ON technical_service_info_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND requested_by_company IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Assignments: Can view their own assignments
CREATE POLICY "Technical companies can view their assignments"
  ON technical_service_assignments FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Technical Service Assignments: Can update their own assignments
CREATE POLICY "Technical companies can update their assignments"
  ON technical_service_assignments FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND company_id IN (
      SELECT technical_company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Profiles: Technical companies can view their own profile
CREATE POLICY "Technical companies can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND id = auth.uid()
  );

-- Profiles: Technical companies can update their own profile
CREATE POLICY "Technical companies can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company'
    AND id = auth.uid()
  );
