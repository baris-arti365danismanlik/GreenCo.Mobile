/*
  # Personel Talep Sistemi - Yeni Yapı

  1. Değişiklikler
    - `personnel_requests` tablosunu yeni gereksinimlere göre güncelle
    - `project_manager_data` ve `personnel_positions` için JSON alanları ekle
    - Proje bilgilerini genişlet (başlangıç/bitiş tarihleri)
    
  2. Yeni Yapı
    - Proje bilgileri: proje adı, başlangıç/bitiş tarihleri, proje yöneticisi
    - Personel pozisyonları: array of JSON (tür, adet, sabıka, sertifikalar)
    - Proje yöneticisi bilgileri: JSON (yeni ise telefon, şifre dahil)
    - is_new_project: boolean (yeni proje mi, mevcut proje mi)
    - is_new_manager: boolean (yeni proje yöneticisi mi)
*/

-- Mevcut tabloyu düşür ve yeniden oluştur
DROP TABLE IF EXISTS personnel_requests CASCADE;

CREATE TABLE personnel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Proje Bilgileri
  project_id uuid REFERENCES projects_greenco(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  project_start_date date NOT NULL,
  project_end_date date NOT NULL,
  is_new_project boolean DEFAULT false,
  
  -- Proje Yöneticisi Bilgileri
  project_manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_new_manager boolean DEFAULT false,
  manager_data jsonb,
  
  -- Personel Pozisyonları (Array of JSON)
  personnel_positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Talep Eden
  requested_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Durum
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  
  -- Notlar
  notes text,
  
  -- Zaman damgaları
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

-- Örnek personnel_positions JSON yapısı:
-- [
--   {
--     "type": "kalifiye",
--     "count": 5,
--     "criminal_record": "yok",
--     "certificates": ["İş Güvenliği", "Forklift"]
--   },
--   {
--     "type": "yarı kalifiye",
--     "count": 3,
--     "criminal_record": "var",
--     "certificates": []
--   }
-- ]

-- Örnek manager_data JSON yapısı (yeni yönetici için):
-- {
--   "full_name": "Ahmet Yılmaz",
--   "phone": "+905551234567",
--   "password": "sifre123"
-- }
