/*
  # Companies RLS - Sadece Admin Tüm Firmaları Görür

  1. Sorun
    - "Technical module admins and operations can view all companies" politikası
    - Operations kullanıcıları technical modülündeyse TÜM firmaları görebiliyor
    - Bu yanlış! Operations sadece kendi firmasını görmeli

  2. Çözüm
    - Technical modül politikası sadece admin için
    - Operations sadece kendi company_id'sindeki firmayı görür
    - Project Manager sadece atandığı projelerin firmalarını görür
*/

-- Yanlış politikayı kaldır
DROP POLICY IF EXISTS "Technical module admins and operations can view all companies" ON companies;

-- Sadece admin için technical modülde tüm firmaları görme
CREATE POLICY "Admins with technical module can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND 'technical' = ANY(profiles.service_modules)
    )
  );
