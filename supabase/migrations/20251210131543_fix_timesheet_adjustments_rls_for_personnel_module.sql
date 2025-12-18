/*
  # Hakediş Düzeltmeleri RLS Policy Düzeltmesi

  ## Değişiklikler
  Operations kullanıcılarının timesheet_adjustments tablosuna erişimi için RLS policy'lerini 
  güncelleyin. Personnel modülü olan operations kullanıcıları hakediş düzeltmesi yapabilmeli.

  ## Güvenlik
  - Operations + Personnel modülü: Insert, Select, Update yetkisi
  - Operations + Technical Services modülü: Insert, Select, Update yetkisi (mevcut)
  - Admin: Tüm kayıtları görebilir
  - Manager: Kendi projelerine ait kayıtları görebilir
*/

-- Mevcut operations insert policy'sini kaldır ve yeniden oluştur
DROP POLICY IF EXISTS "Operations can insert adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
      OR 'personnel' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
    )
  );

-- Mevcut operations select policy'sini kaldır ve yeniden oluştur
DROP POLICY IF EXISTS "Operations can view adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
      OR 'personnel' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
    )
  );

-- Mevcut operations update policy'sini kaldır ve yeniden oluştur
DROP POLICY IF EXISTS "Operations can update own adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can update own adjustments"
  ON timesheet_adjustments
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
      OR 'personnel' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
    )
  )
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
      OR 'personnel' = ANY(
        SELECT jsonb_array_elements_text(
          COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
        )::text
      )
    )
  );
