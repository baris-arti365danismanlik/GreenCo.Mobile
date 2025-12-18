/*
  # Technical Modül Firmaları RLS Düzeltmesi

  1. Sorun
    - "Technical module users can view all companies" politikası
    - Project Manager'lar da technical modülünde olunca TÜM firmaları görebiliyor
    - Bu güvenlik açığı!

  2. Çözüm
    - Technical modül politikası sadece admin ve operations için geçerli
    - Project Manager'lar technical modülünde olsa bile sadece atandıkları projelerin firmalarını görebilir
*/

-- Mevcut geniş technical modül politikasını kaldır
DROP POLICY IF EXISTS "Technical module users can view all companies" ON companies;

-- Sadece admin ve operations için technical modül firmaları
CREATE POLICY "Technical module admins and operations can view all companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'operations')
      AND 'technical' = ANY(profiles.service_modules)
    )
  );
