/*
  # Proje Yöneticileri İçin RLS Politikası

  1. Değişiklikler
    - `projects_greenco` tablosuna proje yöneticilerinin kendi projelerini görüntüleyebilmesi için RLS politikası eklendi
    
  2. Güvenlik
    - Proje yöneticileri sadece `project_managers` tablosunda kendilerine atanmış projeleri görebilir
    - SELECT yetkisi ile sınırlı (sadece okuma)
*/

CREATE POLICY "Project managers can view assigned projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_managers
      WHERE project_managers.project_id = projects_greenco.id
      AND project_managers.manager_id = auth.uid()
    )
  );
