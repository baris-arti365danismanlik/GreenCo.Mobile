/*
  # Personel Talep Sistemi

  1. Yeni Tablolar
    - `personnel_requests`: Operasyon yöneticilerinin personel talepleri
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key -> projects_greenco)
      - `requested_by` (uuid, foreign key -> profiles)
      - `personnel_count` (integer) - İstenen personel sayısı
      - `personnel_type` (text) - Personel türü (kalifiye, yarı kalifiye, kalifiye olmayan)
      - `position` (text) - Pozisyon (isteğe bağlı)
      - `start_date` (date) - Başlangıç tarihi
      - `duration_days` (integer) - Süre (gün)
      - `notes` (text) - Notlar
      - `status` (text) - pending, approved, rejected
      - `approved_by` (uuid, foreign key -> profiles)
      - `approved_at` (timestamptz)
      - `rejection_reason` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Güvenlik
    - RLS aktif
    - Operasyon yöneticileri kendi taleplerini oluşturabilir ve görüntüleyebilir
    - Adminler tüm talepleri görebilir ve onaylayabilir
*/

CREATE TABLE IF NOT EXISTS personnel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects_greenco(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  personnel_count integer NOT NULL CHECK (personnel_count > 0),
  personnel_type text NOT NULL CHECK (personnel_type IN ('kalifiye', 'yarı kalifiye', 'kalifiye olmayan')),
  position text,
  start_date date NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days > 0),
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS aktif
ALTER TABLE personnel_requests ENABLE ROW LEVEL SECURITY;

-- Operasyon yöneticileri kendi taleplerini oluşturabilir
CREATE POLICY "Operations can create requests"
  ON personnel_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
    )
  );

-- Operasyon yöneticileri kendi taleplerini görüntüleyebilir
CREATE POLICY "Operations can view own requests"
  ON personnel_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'operations'
    )
  );

-- Adminler tüm talepleri görebilir ve yönetebilir
CREATE POLICY "Admins manage all requests"
  ON personnel_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_personnel_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_personnel_requests_updated_at
  BEFORE UPDATE ON personnel_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_personnel_requests_updated_at();
