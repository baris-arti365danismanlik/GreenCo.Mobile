/*
  # Project Manager'ların atanmış personnel profillerini görebilmesi

  1. Yeni Politika
    - Project manager'lar kendi projelerindeki personnel'lerin profillerini görebilir
    - project_assignments tablosu üzerinden kontrol edilir
  
  2. Güvenlik
    - Sadece kendi yönettikleri projelerdeki personnel'leri görebilirler
    - Role kontrolü JWT metadata üzerinden yapılır
*/

-- Önce mevcut benzer politikaları temizleyelim (varsa)
DROP POLICY IF EXISTS "Project managers can view assigned personnel profiles" ON profiles;

-- Project manager'lar atanmış personnel'lerin profillerini görebilir
CREATE POLICY "Project managers can view assigned personnel profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'personnel' 
    AND ((auth.jwt() -> 'app_metadata')::jsonb ->> 'role') = 'project_manager'
    AND EXISTS (
      SELECT 1 
      FROM project_assignments pa
      INNER JOIN project_managers pm ON pm.project_id = pa.project_id
      WHERE pa.worker_id = profiles.id
      AND pm.manager_id = auth.uid()
    )
  );
