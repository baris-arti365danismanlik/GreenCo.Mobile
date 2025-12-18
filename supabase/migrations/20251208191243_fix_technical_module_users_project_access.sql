/*
  # Technical Modül Kullanıcıları Proje Erişim Düzeltmesi

  1. Değişiklikler
    - Technical modülü olan kullanıcıların tüm projeleri görmesini engelleyen politika kaldırıldı
    - Yeni politika: Technical modülü olan kullanıcılar sadece kendi oluşturdukları technical requestlerin projelerini görebilir
  
  2. Güvenlik
    - Proje yöneticileri technical modülü olsa bile sadece atandıkları projeleri görecek
    - Technical modül kullanıcıları sadece kendi oluşturdukları taleplerin projelerini görecek
*/

-- Mevcut "tüm projeleri gör" politikasını kaldır
DROP POLICY IF EXISTS "Users with technical module can view all projects" ON projects_greenco;

-- Yeni politika: Technical modül kullanıcıları sadece kendi oluşturdukları technical requestlerin projelerini görebilir
CREATE POLICY "Technical users can view their request projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    -- Technical modülü varsa VE proje yöneticisi değilse
    (((auth.jwt() -> 'app_metadata'::text) -> 'service_modules'::text) @> '["technical"]'::jsonb)
    AND (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) != 'project_manager'::text)
    AND id IN (
      SELECT DISTINCT project_id
      FROM technical_service_requests
      WHERE created_by = auth.uid()
      AND project_id IS NOT NULL
    )
  );
