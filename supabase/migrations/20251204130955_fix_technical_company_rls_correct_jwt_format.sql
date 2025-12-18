/*
  # Technical Company RLS - Doğru JWT Format

  1. Değişiklikler
    - JWT parsing formatını düzelt
    - auth.jwt()->'app_metadata'->>'role' şeklinde kullan
    - UUID casting'i düzelt
    
  2. Güvenlik
    - Technical company kullanıcıları sadece kendi şirketlerini görebilir
*/

-- Eski politikaları sil
DROP POLICY IF EXISTS "Technical companies can view their own company" ON technical_service_companies;
DROP POLICY IF EXISTS "Technical companies can update their own company" ON technical_service_companies;

-- Yeni politikalar - Doğru JWT format
CREATE POLICY "Technical companies can view their own company"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->'app_metadata'->>'role' = 'technical_company'
    AND id = (auth.jwt()->'app_metadata'->>'technical_company_id')::uuid
  );

CREATE POLICY "Technical companies can update their own company"
  ON technical_service_companies
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt()->'app_metadata'->>'role' = 'technical_company'
    AND id = (auth.jwt()->'app_metadata'->>'technical_company_id')::uuid
  )
  WITH CHECK (
    auth.jwt()->'app_metadata'->>'role' = 'technical_company'
    AND id = (auth.jwt()->'app_metadata'->>'technical_company_id')::uuid
  );
