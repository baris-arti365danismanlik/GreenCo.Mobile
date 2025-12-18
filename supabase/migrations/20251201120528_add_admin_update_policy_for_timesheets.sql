/*
  # Admin Puantaj Güncelleme Yetkisi

  ## Değişiklikler
  
  ### `timesheet_periods` tablosu
  - Admin kullanıcıları puantajları güncelleyebilir (final onay için)
  
  ## Güvenlik (RLS)
  
  - Admin: Tüm puantajları görüntüleyebilir ve güncelleyebilir
  - Admin final onay yapabilir (status değişikliği)
  
  ## Notlar
  
  - Admin'in UPDATE yetkisi eksikti, bu nedenle kesinleştirme butonu çalışmıyordu
  - Bu migration sadece eksik UPDATE politikasını ekler
*/

-- Admin: Tüm puantajları görüntüleyebilir
CREATE POLICY "Admin can view all timesheets"
  ON timesheet_periods FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Admin: Tüm puantajları güncelleyebilir
CREATE POLICY "Admin can update all timesheets"
  ON timesheet_periods FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
