/*
  # Project Manager'ların Proje Taleplerini Güncelleyebilmesi

  1. Değişiklikler
    - Project manager'ların kendi projelerindeki talepleri güncelleyebilmesi için RLS politikası güncellendi
    - Artık project manager, projesindeki tüm talepleri (operations veya kendisi tarafından oluşturulmuş) düzenleyebilir ve iptal edebilir
  
  2. Güvenlik
    - Project manager sadece kendi projelerindeki talepleri güncelleyebilir
    - Status değişikliği 'cancelled' olarak sınırlandırıldı
*/

-- Eski politikayı kaldır
DROP POLICY IF EXISTS "Project managers can update own requests" ON personnel_requests;

-- Yeni politika: Project manager kendi projelerindeki talepleri güncelleyebilir
CREATE POLICY "Project managers can update project requests"
  ON personnel_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- Talebi oluşturan kişi
    (auth.uid() = requested_by AND status = ANY (ARRAY['pending'::text, 'awaiting_assignment'::text]))
    OR
    -- Veya projenin project manager'ı
    (
      project_id IN (
        SELECT pm.project_id
        FROM project_managers pm
        WHERE pm.manager_id = auth.uid()
      )
      AND status = ANY (ARRAY['pending'::text, 'awaiting_assignment'::text])
    )
  )
  WITH CHECK (
    -- Talebi oluşturan kişi herhangi bir güncelleme yapabilir
    (auth.uid() = requested_by AND status = ANY (ARRAY['pending'::text, 'awaiting_assignment'::text, 'cancelled'::text]))
    OR
    -- Project manager sadece iptal edebilir veya pending/awaiting_assignment durumunu güncelleyebilir
    (
      project_id IN (
        SELECT pm.project_id
        FROM project_managers pm
        WHERE pm.manager_id = auth.uid()
      )
      AND status = ANY (ARRAY['pending'::text, 'awaiting_assignment'::text, 'cancelled'::text])
    )
  );
