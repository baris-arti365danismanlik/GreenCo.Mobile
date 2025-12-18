/*
  # Hakediş (Invoice) Sistemi

  ## Yeni Tablolar
  
  ### `invoices`
  Hakediş kayıtlarını tutar
  - `id` (uuid, primary key)
  - `timesheet_period_id` (uuid, foreign key) - Hangi puantaj döneminden oluşturuldu
  - `project_id` (uuid, foreign key) - Hangi proje
  - `invoice_number` (text) - Hakediş numarası (otomatik)
  - `period_start` (date) - Dönem başlangıcı
  - `period_end` (date) - Dönem bitişi
  - `total_hours` (numeric) - Toplam saat
  - `total_personnel` (integer) - Toplam personel sayısı
  - `total_amount` (numeric) - Toplam tutar (TL)
  - `personnel_breakdown` (jsonb) - Personel bazlı detay
    ```json
    [
      {
        "personnel_id": "uuid",
        "full_name": "string",
        "personnel_type": "string",
        "total_hours": 40.5,
        "total_days": 5,
        "hourly_rate": 150.00,
        "total_amount": 6075.00
      }
    ]
    ```
  - `status` (enum) - pending, approved, paid, cancelled
  - `created_by` (uuid) - Operasyon kullanıcısı
  - `created_at` (timestamptz)
  - `approved_by` (uuid) - Onaylayan (muhasebe/admin)
  - `approved_at` (timestamptz)
  - `paid_at` (timestamptz)
  - `notes` (text)

  ## Güncellenen Tablolar
  
  ### `timesheet_periods`
  - Yeni status: `invoice_pending`, `invoice_completed`
  - `invoice_created_by` (uuid) - Hakediş'i oluşturan operasyon
  - `invoice_created_at` (timestamptz)

  ### `personnel` tablosu
  - `hourly_rate` zaten var ✓

  ### `profiles` tablosu  
  - `hourly_rate` (numeric) - Personel için saatlik ücret

  ## Güvenlik (RLS)
  
  ### `invoices` tablosu
  - Admin: Tüm hakediş kayıtlarını görebilir
  - Operasyon: Kendi oluşturduğu hakediş kayıtlarını görebilir
  - Proje Müdürü: Kendi projelerinin hakediş kayıtlarını görüntüleyebilir (readonly)

  ## Notlar
  
  - Hakediş numarası otomatik oluşturulur: INV-YYYYMM-0001
  - Bir puantaj döneminden sadece bir kez hakediş oluşturulabilir
  - Personel saatlik ücretleri profiles tablosundan alınır
*/

-- Hakediş durumları için enum
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Puantaj durumlarına yeni statüler ekle
ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'invoice_pending';
ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'invoice_completed';

-- profiles tablosuna hourly_rate ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hourly_rate numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- timesheet_periods tablosuna hakediş alanları ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_periods' AND column_name = 'invoice_created_by'
  ) THEN
    ALTER TABLE timesheet_periods ADD COLUMN invoice_created_by uuid REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_periods' AND column_name = 'invoice_created_at'
  ) THEN
    ALTER TABLE timesheet_periods ADD COLUMN invoice_created_at timestamptz;
  END IF;
END $$;

-- Hakediş tablosu oluştur
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid REFERENCES timesheet_periods(id) UNIQUE NOT NULL,
  project_id uuid REFERENCES projects_greenco(id) NOT NULL,
  invoice_number text UNIQUE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_hours numeric(10,2) DEFAULT 0,
  total_personnel integer DEFAULT 0,
  total_amount numeric(12,2) DEFAULT 0,
  personnel_breakdown jsonb DEFAULT '[]'::jsonb,
  status invoice_status DEFAULT 'pending',
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  notes text
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_invoices_timesheet_period ON invoices(timesheet_period_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Hakediş numarası otomatik oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  year_month text;
  next_number integer;
  invoice_num text;
BEGIN
  year_month := to_char(now(), 'YYYYMM');
  
  SELECT COALESCE(MAX(
    CAST(
      substring(invoice_number from 'INV-' || year_month || '-(\d+)') 
      AS integer
    )
  ), 0) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_month || '-%';
  
  invoice_num := 'INV-' || year_month || '-' || lpad(next_number::text, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- RLS aktif et
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Admin: Tüm hakediş kayıtlarını görebilir
CREATE POLICY "Admin can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- Operasyon: Kendi oluşturduğu hakediş kayıtlarını görebilir
CREATE POLICY "Operations can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'operations' 
    AND created_by = auth.uid()
  );

-- Proje Müdürü: Kendi projelerinin hakediş kayıtlarını görebilir
CREATE POLICY "Project managers can view project invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = invoices.project_id
      AND pm.manager_id = auth.uid()
    )
  );

-- Operasyon: Hakediş oluşturabilir
CREATE POLICY "Operations can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'operations');

-- Admin: Hakediş güncelleyebilir (onay/ödeme)
CREATE POLICY "Admin can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
