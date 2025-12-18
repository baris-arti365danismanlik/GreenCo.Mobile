/*
  # Technical Company RLS Düzeltmesi

  1. Değişiklikler
    - Technical company kullanıcılarının kendi şirketlerini görme politikasını düzelt
    - Profiles tablosunu sorgulama yerine doğrudan JWT'den technical_company_id al
    - UPDATE politikasını da aynı şekilde düzelt
    
  2. Güvenlik
    - Her technical_company kullanıcısı sadece kendi şirketini görebilir
    - JWT metadata üzerinden doğrudan kontrol
*/

-- Eski politikaları sil
DROP POLICY IF EXISTS "Technical companies can view their own company" ON technical_service_companies;
DROP POLICY IF EXISTS "Technical companies can update their own company" ON technical_service_companies;

-- Yeni politikalar - JWT'den doğrudan kontrol
CREATE POLICY "Technical companies can view their own company"
  ON technical_service_companies
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical_company'
    AND id = ((auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id')::uuid
  );

CREATE POLICY "Technical companies can update their own company"
  ON technical_service_companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical_company'
    AND id = ((auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id')::uuid
  )
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'technical_company'
    AND id = ((auth.jwt()->>'app_metadata')::jsonb->>'technical_company_id')::uuid
  );
