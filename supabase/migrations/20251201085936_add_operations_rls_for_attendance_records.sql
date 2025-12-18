/*
  # Operasyon için Devamsızlık Kayıtları RLS

  ## Değişiklikler
  
  ### `attendance_records` tablosu
  - Operasyon kullanıcıları TÜM devamsızlık kayıtlarını görüntüleyebilir
  - Bu, puantaj detay sayfasında personel breakdown göstermek için gerekli

  ## Notlar
  
  - Operasyon sadece SELECT yetkisine sahip (güvenli)
  - Oluşturma/güncelleme/silme yok
*/

-- Operasyon kullanıcıları tüm devamsızlık kayıtlarını görüntüleyebilir
CREATE POLICY "Operations can view all attendance records"
  ON attendance_records FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'operations');
