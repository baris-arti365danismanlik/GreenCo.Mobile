/*
  # Birim Bazlı İş Emirleri RLS Politikaları

  ## Değişiklikler
  
  unit_based_work_orders tablosu için RLS politikaları ekleniyor:
  - Admin: Tüm işlemler yapabilir
  - Operations: CRUD yapabilir
  - Project Manager: Kendi projelerine ait iş emirlerini görüntüleyebilir
  
  ## Güvenlik
  
  - Admin tüm iş emirlerini yönetebilir
  - Operations tüm iş emirlerini yönetebilir
  - Project Manager sadece atandığı projelerin iş emirlerini görür
*/

-- Admin: Tüm iş emirlerini görebilir
CREATE POLICY "Admin can view all unit work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: İş emri oluşturabilir
CREATE POLICY "Admin can insert unit work orders"
  ON unit_based_work_orders FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: İş emri güncelleyebilir
CREATE POLICY "Admin can update unit work orders"
  ON unit_based_work_orders FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Admin: İş emri silebilir
CREATE POLICY "Admin can delete unit work orders"
  ON unit_based_work_orders FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'admin');

-- Operations: Tüm iş emirlerini görebilir
CREATE POLICY "Operations can view all unit work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Operations: İş emri oluşturabilir
CREATE POLICY "Operations can insert unit work orders"
  ON unit_based_work_orders FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Operations: İş emri güncelleyebilir
CREATE POLICY "Operations can update unit work orders"
  ON unit_based_work_orders FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations')
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Operations: İş emri silebilir
CREATE POLICY "Operations can delete unit work orders"
  ON unit_based_work_orders FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');

-- Project Manager: Atandığı projelerin iş emirlerini görebilir
CREATE POLICY "Project Manager can view assigned project work orders"
  ON unit_based_work_orders FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND project_id IN (
      SELECT project_id FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  );
