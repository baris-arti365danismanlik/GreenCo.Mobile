/*
  # Proje Yöneticileri Firma Erişim Düzeltmesi

  1. Değişiklikler
    - Proje yöneticilerinin tüm firmaları görmesini engelleyen politika kaldırıldı
    - Yeni politika: Proje yöneticileri sadece atandıkları projelerin firmalarını görebilir
  
  2. Güvenlik
    - Proje yöneticileri artık sadece kendi projelerinin firmalarını görecek
    - Diğer projelerin firmaları gizli kalacak
*/

-- Mevcut "tüm firmaları gör" politikasını kaldır
DROP POLICY IF EXISTS "Project managers can view all companies" ON companies;

-- Yeni politika: Sadece atandığı projelerin firmalarını görebilir
CREATE POLICY "Project managers can view their project companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'project_manager'::text)
    AND id IN (
      SELECT DISTINCT p.company_id 
      FROM projects_greenco p
      INNER JOIN project_managers pm ON pm.project_id = p.id
      WHERE pm.manager_id = auth.uid()
      AND p.company_id IS NOT NULL
    )
  );
