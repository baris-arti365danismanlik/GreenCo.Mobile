/*
  # Create Unit-Based Invoices Table

  1. New Tables
    - `unit_invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique) - Hakediş numarası
      - `work_order_id` (uuid) - İş emri referansı
      - `project_id` (uuid) - Proje referansı
      - `invoice_date` (date) - Hakediş tarihi
      - `total_amount` (numeric) - Toplam tutar
      - `status` (enum) - Durum
      - `notes` (text) - Notlar
      - `created_by` (uuid) - Oluşturan kullanıcı
      - `approved_by` (uuid) - Onaylayan kullanıcı
      - `approved_at` (timestamptz) - Onay tarihi
      - `created_at` (timestamptz) - Oluşturma tarihi
      - `updated_at` (timestamptz) - Güncellenme tarihi

  2. Security
    - Enable RLS on `unit_invoices` table
    - Add policies for admin and operations users
*/

-- Create unit_invoices table
CREATE TABLE IF NOT EXISTS unit_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  work_order_id uuid NOT NULL REFERENCES unit_based_work_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects_greenco(id) ON DELETE CASCADE,
  invoice_date date NOT NULL,
  total_amount numeric NOT NULL,
  status unit_invoice_status DEFAULT 'pending_operations_approval',
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE unit_invoices ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin users can manage unit invoices"
  ON unit_invoices
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Operations users can view and create
CREATE POLICY "Operations users can view unit invoices"
  ON unit_invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );

CREATE POLICY "Operations users can create unit invoices"
  ON unit_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );

-- Project managers can view invoices for their projects
CREATE POLICY "Project managers can view their project invoices"
  ON unit_invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_unit_invoices_work_order ON unit_invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_project ON unit_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_status ON unit_invoices(status);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_created_at ON unit_invoices(created_at DESC);
