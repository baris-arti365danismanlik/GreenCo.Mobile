/*
  # Operations Rolü için RLS Düzeltmesi

  1. Değişiklikler
    - `projects_greenco` tablosundaki SELECT politikasına `operations` rolü eklendi
    - `profiles` tablosundaki SELECT politikasına `operations` rolü eklendi
    
  2. Güvenlik
    - Operations rolündeki kullanıcılar tüm projeleri görebilir (personel talebi oluşturmak için)
    - Operations rolündeki kullanıcılar tüm proje yöneticilerini görebilir (atama yapabilmek için)
*/

-- Eski politikaları kaldır
DROP POLICY IF EXISTS "Operations and admins can view all projects" ON projects_greenco;
DROP POLICY IF EXISTS "Operations and admins can view project managers" ON profiles;

-- Operations ve operations_manager ve admin'ler tüm projeleri görebilir
CREATE POLICY "Operations and admins can view all projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operations', 'operations_manager', 'admin')
  );

-- Operations ve operations_manager ve admin'ler tüm proje yöneticilerini görebilir
CREATE POLICY "Operations and admins can view project managers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'project_manager' 
    AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operations', 'operations_manager', 'admin')
  );
