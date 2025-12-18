/*
  # Profiles RLS Infinite Recursion Düzeltmesi

  1. Değişiklikler
    - `profiles` tablosundaki "Operations and admins can view project managers" politikası güncellendi
    - Politika içinde `profiles` tablosunu sorgulamak yerine JWT metadata kullanıldı
    
  2. Güvenlik
    - Operations, operations_manager ve admin rollerindeki kullanıcılar proje yöneticilerini görebilir
    - Infinite recursion sorunu çözüldü
*/

-- Eski politikayı kaldır
DROP POLICY IF EXISTS "Operations and admins can view project managers" ON profiles;

-- JWT metadata kullanarak yeni politika oluştur
CREATE POLICY "Operations and admins can view project managers"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'project_manager' 
    AND 
    ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('operations', 'operations_manager', 'admin')
  );
