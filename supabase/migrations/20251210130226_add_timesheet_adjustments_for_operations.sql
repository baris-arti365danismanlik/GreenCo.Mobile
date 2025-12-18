/*
  # Hakediş Düzeltmeleri (Timesheet Adjustments)

  ## Amaç
  Operasyon personelinin hakediş onaylandıktan sonra personel bazında dip rakam (toplam tutar) 
  düzeltmesi yapabilmesini sağlar. Düzeltme nedeni zorunludur ve hem orijinal hem düzeltilmiş 
  değer saklanır.

  ## Yeni Tablo
  - `timesheet_adjustments`
    - `id` (uuid, primary key) - Düzeltme kaydı ID
    - `timesheet_period_id` (uuid, foreign key) - Hangi hakediş dönemi
    - `worker_id` (uuid, foreign key) - Hangi personel için düzeltme
    - `original_amount` (numeric) - Orijinal hesaplanan tutar
    - `adjusted_amount` (numeric) - Düzeltilmiş tutar
    - `adjustment_reason` (text, NOT NULL) - Düzeltme nedeni (zorunlu)
    - `adjusted_by` (uuid, foreign key) - Kim düzeltti
    - `adjusted_at` (timestamptz) - Ne zaman düzeltildi
    - `created_at` (timestamptz) - Kayıt oluşturma zamanı

  ## Güvenlik (RLS)
  - Operations: Düzeltme ekleyebilir ve görebilir
  - Admin + Manager: Sadece görebilir (düzelteme yapamaz)
  
  ## İş Kuralları
  - Aynı personel için aynı hakediş döneminde sadece 1 düzeltme olabilir (unique constraint)
  - Düzeltme nedeni boş bırakılamaz
  - Tekrar onaya gitmez, sadece raporlarda görünür
*/

-- Düzeltmeler tablosu
CREATE TABLE IF NOT EXISTS timesheet_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_period_id uuid NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_amount numeric(12,2) NOT NULL,
  adjusted_amount numeric(12,2) NOT NULL,
  adjustment_reason text NOT NULL CHECK (char_length(trim(adjustment_reason)) > 0),
  adjusted_by uuid NOT NULL REFERENCES profiles(id),
  adjusted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Aynı personel için aynı hakediş döneminde sadece 1 düzeltme
  UNIQUE(timesheet_period_id, worker_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_timesheet_adjustments_period 
  ON timesheet_adjustments(timesheet_period_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_adjustments_worker 
  ON timesheet_adjustments(worker_id);

-- RLS aktif
ALTER TABLE timesheet_adjustments ENABLE ROW LEVEL SECURITY;

-- Operations: Düzeltme ekleyebilir (INSERT)
CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    'technical_services' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
      )::text
    )
    AND (auth.jwt()->>'role') = 'operations'
  );

-- Operations: Düzeltmeleri görebilir (SELECT)
CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    'technical_services' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
      )::text
    )
    AND (auth.jwt()->>'role') = 'operations'
  );

-- Admin: Tüm düzeltmeleri görebilir (SELECT)
CREATE POLICY "Admin can view all adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role') = 'admin');

-- Manager: Kendi projelerine ait düzeltmeleri görebilir (SELECT)
CREATE POLICY "Manager can view project adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 FROM timesheet_periods tp
      WHERE tp.id = timesheet_adjustments.timesheet_period_id
      AND EXISTS (
        SELECT 1 FROM project_managers pm
        WHERE pm.project_id = tp.project_id
        AND pm.manager_id = auth.uid()
      )
    )
  );

-- Operations: Kendi düzeltmelerini güncelleyebilir (UPDATE)
CREATE POLICY "Operations can update own adjustments"
  ON timesheet_adjustments
  FOR UPDATE
  TO authenticated
  USING (
    'technical_services' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
      )::text
    )
    AND (auth.jwt()->>'role') = 'operations'
  )
  WITH CHECK (
    'technical_services' = ANY(
      SELECT jsonb_array_elements_text(
        COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
      )::text
    )
    AND (auth.jwt()->>'role') = 'operations'
  );
