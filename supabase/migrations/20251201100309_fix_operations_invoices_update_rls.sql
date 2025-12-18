/*
  # Operasyon Hakediş UPDATE RLS Düzeltmesi

  ## Değişiklikler
  
  ### RLS Policy Güncellemesi
  - Operations invoices UPDATE policy'yi düzelt
  - `auth.jwt() ->> 'role'` yerine `auth.jwt() -> 'app_metadata' ->> 'role'` kullan
  
  ## Sorun
  
  Operasyon kullanıcıları hakediş kayıtlarını güncelleyemiyordu (pending → submitted) 
  çünkü RLS policy yanlış JWT path'i kullanıyordu.
  
  ## Çözüm
  
  Role bilgisi `app_metadata` içinde saklanıyor, doğrudan JWT root'unda değil.
*/

-- Operations invoices UPDATE policy'yi güncelle
DROP POLICY IF EXISTS "Operations can update invoices" ON invoices;

CREATE POLICY "Operations can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'operations'
  );
