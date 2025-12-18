/*
  # Operations Manager ve Admin için RLS Politikaları

  1. Değişiklikler
    - `projects_greenco` tablosuna operations_manager ve admin rollerinin tüm projeleri görebilmesi için RLS politikası
    - `profiles` tablosuna operations_manager rolünün proje yöneticilerini görebilmesi için RLS politikası
    
  2. Güvenlik
    - Operations manager'lar tüm aktif projeleri görebilir (personel talebi oluşturmak için)
    - Operations manager'lar tüm proje yöneticilerini görebilir (atama yapabilmek için)
    - Admin'ler zaten tüm verileri görebilir
*/

-- Operations manager ve admin'ler tüm projeleri görebilir
CREATE POLICY "Operations and admins can view all projects"
  ON projects_greenco
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operations_manager', 'admin')
  );

-- Operations manager ve admin'ler tüm proje yöneticilerini görebilir
CREATE POLICY "Operations and admins can view project managers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'project_manager' 
    AND 
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('operations_manager', 'admin')
  );
