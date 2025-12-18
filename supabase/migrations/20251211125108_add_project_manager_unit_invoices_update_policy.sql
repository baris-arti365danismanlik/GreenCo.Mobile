/*
  # Proje Yöneticisinin Birim Hakedişlerini Güncelleyebilmesi
  
  1. Değişiklikler
    - Proje yöneticisinin kendi projelerindeki hakedişlere yorum ekleyebilmesi için UPDATE policy eklendi
    - Proje yöneticisi notes alanını güncelleyebilecek
    - Sadece kendi yönettiği projelerdeki hakedişleri güncelleyebilecek
*/

-- Proje yöneticisinin kendi projelerindeki hakedişlere yorum ekleyebilmesi için policy
CREATE POLICY "Project managers can update their project invoices notes"
  ON unit_invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND project_id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'project_manager'
    AND project_id IN (
      SELECT project_id 
      FROM project_managers 
      WHERE manager_id = auth.uid()
    )
  );
