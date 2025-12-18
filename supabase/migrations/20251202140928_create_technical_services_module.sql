/*
  # Create Technical Services Module

  1. New Tables
    - `technical_service_types`
      - `id` (uuid, primary key)
      - `name` (text, e.g., "Elektrik", "Tesisat", "Klima")
      - `description` (text, optional)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
    
    - `technical_service_requests`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects_greenco)
      - `company_id` (uuid, foreign key to companies)
      - `service_type_id` (uuid, foreign key to technical_service_types)
      - `title` (text, short description)
      - `description` (text, detailed problem description)
      - `location_city` (text)
      - `location_district` (text)
      - `location_address` (text)
      - `attachment_urls` (text[], images/documents)
      - `status` (enum: pending_review, info_needed, bidding, approved, in_progress, completed, cancelled)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `technical_service_companies`
      - `id` (uuid, primary key)
      - `company_name` (text)
      - `tax_number` (text)
      - `phone` (text)
      - `email` (text)
      - `location_city` (text)
      - `location_district` (text)
      - `bank_name` (text)
      - `bank_account_holder` (text)
      - `iban` (text)
      - `average_rating` (numeric, default 0)
      - `total_jobs` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
    
    - `technical_service_company_specialties`
      - Junction table for many-to-many relationship
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to technical_service_companies)
      - `service_type_id` (uuid, foreign key to technical_service_types)
      - UNIQUE(company_id, service_type_id)
    
    - `technical_service_bids`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to technical_service_requests)
      - `company_id` (uuid, foreign key to technical_service_companies)
      - `bid_amount` (numeric)
      - `estimated_duration` (text, e.g., "2 gün")
      - `description` (text, teklif detayları)
      - `status` (enum: pending, accepted, rejected, withdrawn)
      - `needs_more_info` (boolean, default false)
      - `info_request_message` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `technical_service_assignments`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to technical_service_requests)
      - `company_id` (uuid, foreign key to technical_service_companies)
      - `bid_id` (uuid, foreign key to technical_service_bids)
      - `final_price` (numeric)
      - `completion_date` (timestamp)
      - `problem_description` (text, final report)
      - `solution_description` (text, what was done)
      - `parts_used` (text, used materials)
      - `labor_cost` (numeric)
      - `parts_cost` (numeric)
      - `warranty_months` (integer)
      - `pm_approved` (boolean, default false)
      - `pm_approved_at` (timestamp)
      - `pm_approved_by` (uuid, foreign key to profiles)
      - `operations_approved` (boolean, default false)
      - `operations_approved_at` (timestamp)
      - `operations_approved_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
    
    - `technical_service_reviews`
      - `id` (uuid, primary key)
      - `assignment_id` (uuid, foreign key to technical_service_assignments)
      - `company_id` (uuid, foreign key to technical_service_companies)
      - `rating` (integer, 1-5)
      - `comment` (text, optional)
      - `reviewed_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
    
    - `technical_service_info_requests`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to technical_service_requests)
      - `requested_by_company` (uuid, foreign key to technical_service_companies)
      - `info_request` (text, what info is needed)
      - `info_response` (text, response from operations)
      - `response_attachment_urls` (text[])
      - `status` (enum: pending, answered)
      - `created_at` (timestamp)
      - `answered_at` (timestamp)

  2. Enums
    - `technical_service_request_status`
    - `technical_service_bid_status`
    - `technical_service_info_status`

  3. Security
    - Enable RLS on all tables
    - Add policies for admin, operations, project_manager, technician roles

  4. Notes
    - Service modules field already added to profiles table
    - Technician companies are separate entities from client companies
    - 3 bids will be collected before presenting to client
    - Approval flow: PM → Operations → Client Review
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE technical_service_request_status AS ENUM (
    'pending_review',
    'info_needed',
    'bidding',
    'approved',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_service_bid_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE technical_service_info_status AS ENUM (
    'pending',
    'answered'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Technical Service Types
CREATE TABLE IF NOT EXISTS technical_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Technical Service Companies (Technicians)
CREATE TABLE IF NOT EXISTS technical_service_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  tax_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  location_city text NOT NULL,
  location_district text NOT NULL,
  bank_name text,
  bank_account_holder text,
  iban text,
  average_rating numeric DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  total_jobs integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. Junction table for company specialties
CREATE TABLE IF NOT EXISTS technical_service_company_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES technical_service_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, service_type_id)
);

-- 4. Technical Service Requests
CREATE TABLE IF NOT EXISTS technical_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects_greenco(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES technical_service_types(id),
  title text NOT NULL,
  description text NOT NULL,
  location_city text NOT NULL,
  location_district text NOT NULL,
  location_address text NOT NULL,
  attachment_urls text[] DEFAULT '{}',
  status technical_service_request_status DEFAULT 'pending_review',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Technical Service Bids
CREATE TABLE IF NOT EXISTS technical_service_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES technical_service_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  bid_amount numeric NOT NULL CHECK (bid_amount > 0),
  estimated_duration text NOT NULL,
  description text NOT NULL,
  status technical_service_bid_status DEFAULT 'pending',
  needs_more_info boolean DEFAULT false,
  info_request_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Info Requests
CREATE TABLE IF NOT EXISTS technical_service_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES technical_service_requests(id) ON DELETE CASCADE,
  requested_by_company uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  info_request text NOT NULL,
  info_response text,
  response_attachment_urls text[] DEFAULT '{}',
  status technical_service_info_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz
);

-- 7. Technical Service Assignments
CREATE TABLE IF NOT EXISTS technical_service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES technical_service_requests(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES technical_service_bids(id),
  final_price numeric NOT NULL,
  completion_date timestamptz,
  problem_description text,
  solution_description text,
  parts_used text,
  labor_cost numeric,
  parts_cost numeric,
  warranty_months integer DEFAULT 0,
  pm_approved boolean DEFAULT false,
  pm_approved_at timestamptz,
  pm_approved_by uuid REFERENCES profiles(id),
  operations_approved boolean DEFAULT false,
  operations_approved_at timestamptz,
  operations_approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 8. Technical Service Reviews
CREATE TABLE IF NOT EXISTS technical_service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES technical_service_assignments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(assignment_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tech_requests_project ON technical_service_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_tech_requests_company ON technical_service_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_tech_requests_status ON technical_service_requests(status);
CREATE INDEX IF NOT EXISTS idx_tech_bids_request ON technical_service_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_tech_bids_company ON technical_service_bids(company_id);
CREATE INDEX IF NOT EXISTS idx_tech_companies_location ON technical_service_companies(location_city, location_district);
CREATE INDEX IF NOT EXISTS idx_tech_company_specialties_company ON technical_service_company_specialties(company_id);
CREATE INDEX IF NOT EXISTS idx_tech_company_specialties_service ON technical_service_company_specialties(service_type_id);

-- Enable RLS
ALTER TABLE technical_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_company_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_info_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_service_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Technical Service Types (Everyone can read)
CREATE POLICY "Anyone can view service types"
  ON technical_service_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage service types"
  ON technical_service_types FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- RLS Policies: Technical Service Companies
CREATE POLICY "Admins and operations can view all companies"
  ON technical_service_companies FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "Admins can manage companies"
  ON technical_service_companies FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- RLS Policies: Company Specialties
CREATE POLICY "Admins and operations can view specialties"
  ON technical_service_company_specialties FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "Admins can manage specialties"
  ON technical_service_company_specialties FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- RLS Policies: Technical Service Requests
CREATE POLICY "Users with technical module can view requests"
  ON technical_service_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
    OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
      AND project_id IN (
        SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "Operations and admins can create requests"
  ON technical_service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "Operations and admins can update requests"
  ON technical_service_requests FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

-- RLS Policies: Bids
CREATE POLICY "Admins and operations can view all bids"
  ON technical_service_bids FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "Admins can manage bids"
  ON technical_service_bids FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- RLS Policies: Info Requests
CREATE POLICY "Admins and operations can view info requests"
  ON technical_service_info_requests FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "Admins and operations can manage info requests"
  ON technical_service_info_requests FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

-- RLS Policies: Assignments
CREATE POLICY "Users can view relevant assignments"
  ON technical_service_assignments FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
    OR
    (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
      AND request_id IN (
        SELECT id FROM technical_service_requests 
        WHERE project_id IN (
          SELECT project_id FROM project_managers WHERE manager_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins and operations can manage assignments"
  ON technical_service_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

CREATE POLICY "PM and operations can approve assignments"
  ON technical_service_assignments FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations', 'project_manager')
  );

-- RLS Policies: Reviews
CREATE POLICY "Everyone can view reviews"
  ON technical_service_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations and admins can create reviews"
  ON technical_service_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

-- Insert default service types
INSERT INTO technical_service_types (name, description) VALUES
  ('Elektrik', 'Elektrik tesisat, arıza ve bakım hizmetleri'),
  ('Tesisat', 'Su ve kalorifer tesisat hizmetleri'),
  ('Klima', 'Klima montaj, bakım ve arıza hizmetleri'),
  ('Boyama', 'İç ve dış cephe boyama hizmetleri'),
  ('Tadilat', 'Genel tadilat ve tamirat hizmetleri'),
  ('Cam Balkon', 'Cam balkon montaj ve tamirat'),
  ('Asansör', 'Asansör bakım ve arıza hizmetleri'),
  ('Kapı-Pencere', 'Kapı ve pencere tamiri/değişimi')
ON CONFLICT (name) DO NOTHING;
