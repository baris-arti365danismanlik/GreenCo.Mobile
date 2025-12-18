/*
  # Teknik Servis Hakediş Sistemi

  ## Yeni Tablolar
  
  ### `technical_service_invoices`
  Teknik servis hakedişlerini yönetmek için ana tablo
  
  **Kolonlar:**
  - `id` (uuid, primary key) - Hakediş benzersiz ID'si
  - `invoice_number` (text, unique) - Hakediş numarası (TS-INV-YYYYMMDD-XXXX formatında)
  - `technical_company_id` (uuid) - Teknik servis şirketi ID'si
  - `period_start` (date) - Hakediş dönemi başlangıç
  - `period_end` (date) - Hakediş dönemi bitiş
  - `assignment_ids` (uuid[]) - Dahil edilen iş ID'leri
  - `total_amount` (numeric) - Toplam tutar
  - `total_jobs` (integer) - Toplam iş sayısı
  - `job_details` (jsonb) - İş detayları (her iş için: id, title, amount, completion_date)
  - `status` - Hakediş durumu (draft, pending, approved, paid, rejected)
  - `created_by` (uuid) - Oluşturan admin
  - `created_at` (timestamptz) - Oluşturulma tarihi
  - `approved_by` (uuid, nullable) - Onaylayan operasyon kullanıcısı
  - `approved_at` (timestamptz, nullable) - Onaylanma tarihi
  - `rejected_by` (uuid, nullable) - Reddeden operasyon kullanıcısı
  - `rejected_at` (timestamptz, nullable) - Reddedilme tarihi
  - `rejection_reason` (text, nullable) - Red nedeni
  - `notes` (text, nullable) - Notlar
  
  ## Güvenlik
  
  ### RLS Politikaları
  - Admin: Tüm hakedişleri görebilir, oluşturabilir
  - Operations: Sadece kendi firmasının hakedişlerini görebilir ve onaylayabilir
  - Technical Company: Kendi hakedişlerini görebilir
*/

-- Create invoice status enum
DO $$ BEGIN
  CREATE TYPE technical_service_invoice_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'paid',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create technical_service_invoices table
CREATE TABLE IF NOT EXISTS technical_service_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  technical_company_id uuid NOT NULL REFERENCES technical_service_companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  assignment_ids uuid[] NOT NULL DEFAULT '{}',
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  total_jobs integer NOT NULL DEFAULT 0 CHECK (total_jobs >= 0),
  job_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  status technical_service_invoice_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES profiles(id),
  rejected_at timestamptz,
  rejection_reason text,
  notes text,
  
  -- Ensure period_start is before period_end
  CONSTRAINT valid_period CHECK (period_start <= period_end)
);

-- Enable RLS
ALTER TABLE technical_service_invoices ENABLE ROW LEVEL SECURITY;

-- Admin: Can view all invoices and create new ones
CREATE POLICY "Admin can view all technical service invoices"
  ON technical_service_invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Admin can create technical service invoices"
  ON technical_service_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Admin can update technical service invoices"
  ON technical_service_invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin'
  );

-- Operations: Can view and approve/reject invoices for their company
CREATE POLICY "Operations can view their company's technical service invoices"
  ON technical_service_invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations'
    AND technical_company_id IN (
      SELECT id FROM technical_service_companies
      WHERE id::text = (auth.jwt()->>'app_metadata')::jsonb->>'company_id'
    )
  );

CREATE POLICY "Operations can update their company's technical service invoices"
  ON technical_service_invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations'
    AND technical_company_id IN (
      SELECT id FROM technical_service_companies
      WHERE id::text = (auth.jwt()->>'app_metadata')::jsonb->>'company_id'
    )
  );

-- Technical Company: Can view their own invoices
CREATE POLICY "Technical company can view their own invoices"
  ON technical_service_invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical_company'
    AND technical_company_id::text = (auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id'
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_technical_service_invoices_company 
  ON technical_service_invoices(technical_company_id);

CREATE INDEX IF NOT EXISTS idx_technical_service_invoices_status 
  ON technical_service_invoices(status);

CREATE INDEX IF NOT EXISTS idx_technical_service_invoices_period 
  ON technical_service_invoices(period_start, period_end);

-- Add invoice_id to technical_service_assignments for tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'technical_service_assignments' 
    AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE technical_service_assignments 
    ADD COLUMN invoice_id uuid REFERENCES technical_service_invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_technical_service_assignments_invoice 
  ON technical_service_assignments(invoice_id);
