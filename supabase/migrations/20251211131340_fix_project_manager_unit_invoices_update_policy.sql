/*
  # Proje Yöneticisi Hakediş Güncelleme Policy'sini Düzelt
  
  1. Değişiklikler
    - Mevcut policy'yi kaldır ve doğru JWT parsing formatıyla yeniden oluştur
    - JWT app_metadata parsing hatası düzeltildi
*/

-- Mevcut policy'yi kaldır
DROP POLICY IF EXISTS "Project managers can update their project invoices notes" ON unit_invoices;

-- Doğru formatta yeniden oluştur
CREATE POLICY "Project managers can update their project invoices"
  ON unit_invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND project_id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'project_manager'
    AND project_id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  );
