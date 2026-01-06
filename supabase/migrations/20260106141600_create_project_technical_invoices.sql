-- Create project_technical_invoices table
CREATE TABLE IF NOT EXISTS project_technical_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES projects_greenco(id) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')) DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  request_ids TEXT[] -- Storing IDs array for easier access if needed
);

-- Add column to link requests to invoices
-- This establishes which invoice covers a specific technical request
ALTER TABLE technical_service_requests 
ADD COLUMN IF NOT EXISTS customer_invoice_id UUID REFERENCES project_technical_invoices(id);

-- Enable Row Level Security
ALTER TABLE project_technical_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read (Admin, Operations, PM etc.)
CREATE POLICY "Enable read access for authenticated users" ON project_technical_invoices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert (mainly Admin/Operations)
CREATE POLICY "Enable insert for authenticated users" ON project_technical_invoices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update
CREATE POLICY "Enable update for authenticated users" ON project_technical_invoices
  FOR UPDATE USING (auth.role() = 'authenticated');
  
-- Allow authenticated users to delete
CREATE POLICY "Enable delete for authenticated users" ON project_technical_invoices
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE project_technical_invoices IS 'Hakedişler (GreenCo -> Proje/Müşteri) için ana tablo. Tamamlanan teknik işlerin faturalanması.';
