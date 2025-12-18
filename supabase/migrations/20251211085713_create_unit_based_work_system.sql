/*
  # Birim Bazlı İş Sistemi (Unit-Based Work System)
  
  ## Yeni Tablolar
  
  ### `service_types`
  Hizmet türleri (temizlik, cam temizliği, peyzaj vs.)
  - Default listesi ile gelir ama yeni türler eklenebilir
  - `id` (uuid, primary key)
  - `name` (text, unique) - Hizmet adı
  - `unit_type` (text) - Birim türü: 'm2', 'adet', 'metre', 'paket' vs.
  - `is_active` (boolean) - Aktif mi?
  - `created_at` (timestamptz)
  - `created_by` (uuid) - Oluşturan admin
  
  ### `unit_based_work_orders`
  Operasyonun oluşturduğu birim bazlı iş talepleri
  - `id` (uuid, primary key)
  - `order_number` (text, unique) - İş emri no (UWO-YYYYMMDD-XXXX)
  - `project_id` (uuid) - Hangi proje
  - `service_type_id` (uuid) - Hizmet türü
  - `quantity` (numeric) - Miktar (örn: 500 m2)
  - `unit_price` (numeric) - Birim fiyat (admin tarafından girilir)
  - `total_amount` (numeric) - Toplam tutar (quantity * unit_price)
  - `description` (text) - İş açıklaması
  - `location_detail` (text) - Konum detayı (kat, bölüm vs.)
  - `start_date` (date) - İş başlangıç tarihi
  - `end_date` (date) - İş bitiş tarihi
  - `status` (enum) - pending, approved, in_progress, completed, cancelled
  - `created_by` (uuid) - Operasyon kullanıcısı
  - `created_at` (timestamptz)
  - `approved_by` (uuid) - Onaylayan admin
  - `approved_at` (timestamptz)
  - `notes` (text)
  
  ### `unit_based_invoices`
  Hakediş talepleri (tamamlanan işler)
  - `id` (uuid, primary key)
  - `invoice_number` (text, unique) - Hakediş no (UBI-YYYYMMDD-XXXX)
  - `work_order_id` (uuid) - Hangi iş emrinden
  - `project_id` (uuid) - Hangi proje
  - `service_type_id` (uuid) - Hizmet türü
  - `completed_quantity` (numeric) - Tamamlanan miktar
  - `unit_price` (numeric) - Birim fiyat
  - `subtotal_amount` (numeric) - Ara toplam
  - `adjustment_amount` (numeric) - Operasyon düzeltmesi (+ veya -)
  - `adjustment_reason` (text) - Düzeltme nedeni
  - `final_amount` (numeric) - Nihai tutar
  - `work_description` (text) - Yapılan iş açıklaması
  - `completion_date` (date) - Tamamlanma tarihi
  - `status` (enum) - pending_manager_review, pending_operations_approval, operations_approved, submitted, paid, cancelled
  - `created_by` (uuid) - Admin
  - `created_at` (timestamptz)
  - `pm_reviewed` (boolean) - PM görüp yorum yaptı mı?
  - `pm_notes` (text) - PM yorumu
  - `pm_reviewed_at` (timestamptz)
  - `pm_reviewed_by` (uuid)
  - `operations_approved_by` (uuid) - Onaylayan operasyon
  - `operations_approved_at` (timestamptz)
  - `operations_notes` (text) - Operasyon notu
  - `notes` (text)
  
  ## Güvenlik (RLS)
  
  - Admin: Tüm kayıtları görebilir, iş emri onaylayabilir, hakediş oluşturabilir
  - Operasyon: İş emri oluşturabilir, hakediş onaylayabilir
  - Proje Müdürü: Kendi projelerinin kayıtlarını görebilir, hakediş üzerinde yorum yapabilir
*/

-- Hizmet türleri tablosu
CREATE TABLE IF NOT EXISTS service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('m2', 'adet', 'metre', 'paket', 'saat', 'gün')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- İş emri durumları için enum
DO $$ BEGIN
  CREATE TYPE unit_work_order_status AS ENUM (
    'pending',
    'approved',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Hakediş durumları için enum
DO $$ BEGIN
  CREATE TYPE unit_invoice_status AS ENUM (
    'pending_manager_review',
    'pending_operations_approval',
    'operations_approved',
    'submitted',
    'paid',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Birim bazlı iş emirleri tablosu
CREATE TABLE IF NOT EXISTS unit_based_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  project_id uuid NOT NULL REFERENCES projects_greenco(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES service_types(id),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) DEFAULT 0 CHECK (unit_price >= 0),
  total_amount numeric(12,2) DEFAULT 0,
  description text NOT NULL,
  location_detail text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status unit_work_order_status DEFAULT 'pending',
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  notes text,
  
  CONSTRAINT valid_work_period CHECK (start_date <= end_date)
);

-- Birim bazlı hakediş tablosu
CREATE TABLE IF NOT EXISTS unit_based_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  work_order_id uuid NOT NULL REFERENCES unit_based_work_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects_greenco(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES service_types(id),
  completed_quantity numeric(12,2) NOT NULL CHECK (completed_quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) DEFAULT 0,
  adjustment_reason text,
  final_amount numeric(12,2) NOT NULL DEFAULT 0,
  work_description text NOT NULL,
  completion_date date NOT NULL,
  status unit_invoice_status DEFAULT 'pending_manager_review',
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  pm_reviewed boolean DEFAULT false,
  pm_notes text,
  pm_reviewed_at timestamptz,
  pm_reviewed_by uuid REFERENCES profiles(id),
  operations_approved_by uuid REFERENCES profiles(id),
  operations_approved_at timestamptz,
  operations_notes text,
  notes text
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_service_types_active ON service_types(is_active);
CREATE INDEX IF NOT EXISTS idx_unit_work_orders_project ON unit_based_work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_unit_work_orders_status ON unit_based_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_unit_work_orders_created_by ON unit_based_work_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_project ON unit_based_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_work_order ON unit_based_invoices(work_order_id);
CREATE INDEX IF NOT EXISTS idx_unit_invoices_status ON unit_based_invoices(status);

-- Default hizmet türleri
INSERT INTO service_types (name, unit_type, is_active) VALUES
  ('Temizlik', 'm2', true),
  ('Cam Temizliği', 'm2', true),
  ('Peyzaj Bakımı', 'm2', true),
  ('Güvenlik', 'saat', true),
  ('Haşere İlaçlama', 'm2', true),
  ('Boyama', 'm2', true),
  ('Elektrik İşleri', 'adet', true),
  ('Sıhhi Tesisat', 'adet', true)
ON CONFLICT (name) DO NOTHING;

-- RLS Aktif Et
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_based_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_based_invoices ENABLE ROW LEVEL SECURITY;

-- ==================== SERVICE_TYPES POLICIES ====================

-- Herkes hizmet türlerini görebilir
CREATE POLICY "Everyone can view active service types"
  ON service_types FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin: Tüm hizmet türlerini görebilir
CREATE POLICY "Admin can view all service types"
  ON service_types FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: Yeni hizmet türü ekleyebilir
CREATE POLICY "Admin can insert service types"
  ON service_types FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: Hizmet türlerini güncelleyebilir
CREATE POLICY "Admin can update service types"
  ON service_types FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- ==================== UNIT_BASED_WORK_ORDERS POLICIES ====================

-- Admin: Tüm iş emirlerini görebilir
CREATE POLICY "Admin can view all work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Operasyon: Kendi oluşturduğu iş emirlerini görebilir
CREATE POLICY "Operations can view own work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations'
    AND created_by = auth.uid()
  );

-- Proje Müdürü: Kendi projelerinin iş emirlerini görebilir
CREATE POLICY "Project managers can view project work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = unit_based_work_orders.project_id
      AND pm.manager_id = auth.uid()
    )
  );

-- Operasyon: İş emri oluşturabilir
CREATE POLICY "Operations can create work orders"
  ON unit_based_work_orders FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Admin: İş emirlerini güncelleyebilir (onaylama, fiyat girme)
CREATE POLICY "Admin can update work orders"
  ON unit_based_work_orders FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- ==================== UNIT_BASED_INVOICES POLICIES ====================

-- Admin: Tüm hakedişleri görebilir
CREATE POLICY "Admin can view all unit invoices"
  ON unit_based_invoices FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Operasyon: Tüm hakedişleri görebilir
CREATE POLICY "Operations can view all unit invoices"
  ON unit_based_invoices FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Proje Müdürü: Kendi projelerinin hakedişlerini görebilir
CREATE POLICY "Project managers can view project unit invoices"
  ON unit_based_invoices FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = unit_based_invoices.project_id
      AND pm.manager_id = auth.uid()
    )
  );

-- Admin: Hakediş oluşturabilir
CREATE POLICY "Admin can create unit invoices"
  ON unit_based_invoices FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: Hakediş güncelleyebilir
CREATE POLICY "Admin can update unit invoices"
  ON unit_based_invoices FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Proje Müdürü: Hakediş üzerinde yorum yapabilir
CREATE POLICY "Project managers can review unit invoices"
  ON unit_based_invoices FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = unit_based_invoices.project_id
      AND pm.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM project_managers pm
      WHERE pm.project_id = unit_based_invoices.project_id
      AND pm.manager_id = auth.uid()
    )
  );

-- Operasyon: Hakediş onaylayabilir/düzenleyebilir
CREATE POLICY "Operations can approve unit invoices"
  ON unit_based_invoices FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');
