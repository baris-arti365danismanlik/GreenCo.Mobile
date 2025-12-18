/*
  # Operations için Teknik Servis Şirketlerine Erişim
  
  Operations kullanıcılarının teknik servis şirketlerini görebilmesi gerekiyor
  (hakediş sistemi için).
  
  ## Güvenlik
  - Operations: Tüm teknik servis şirketlerini görebilir (sadece okuma)
*/

-- Operations can view all technical service companies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'technical_service_companies' 
    AND policyname = 'Operations can view all technical service companies'
  ) THEN
    CREATE POLICY "Operations can view all technical service companies"
      ON technical_service_companies
      FOR SELECT
      TO authenticated
      USING (
        (auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations'
      );
  END IF;
END $$;
