/*
  # Hakediş Düzeltmeleri RLS Policy Basitleştirme

  ## Değişiklikler
  Policy'lerde IN yerine = ANY operatörü kullanarak daha basit ve güvenilir kontrol yapalım.

  ## Güvenlik
  - Operations + Personnel veya Technical Services modülü olan kullanıcılar erişebilir
*/

-- INSERT policy'yi yeniden oluştur
DROP POLICY IF EXISTS "Operations can insert adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can insert adjustments"
  ON timesheet_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
      OR 'personnel' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
    )
  );

-- SELECT policy'yi yeniden oluştur
DROP POLICY IF EXISTS "Operations can view adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can view adjustments"
  ON timesheet_adjustments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
      OR 'personnel' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
    )
  );

-- UPDATE policy'yi yeniden oluştur
DROP POLICY IF EXISTS "Operations can update own adjustments" ON timesheet_adjustments;

CREATE POLICY "Operations can update own adjustments"
  ON timesheet_adjustments
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
      OR 'personnel' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
    )
  )
  WITH CHECK (
    (auth.jwt()->>'role') = 'operations'
    AND (
      'technical_services' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
      OR 'personnel' = ANY(
        ARRAY(
          SELECT jsonb_array_elements_text(
            COALESCE(auth.jwt()->'app_metadata'->'service_modules', '[]'::jsonb)
          )
        )
      )
    )
  );
