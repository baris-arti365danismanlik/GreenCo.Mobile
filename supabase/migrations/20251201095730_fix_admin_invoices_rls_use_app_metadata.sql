/*
  # Admin Hakediş RLS Düzeltmesi

  ## Değişiklikler
  
  ### RLS Policy Güncellemesi
  - Admin invoices SELECT policy'yi düzelt
  - Admin invoices UPDATE policy'yi düzelt
  - `auth.jwt() ->> 'role'` yerine `auth.jwt() -> 'app_metadata' ->> 'role'` kullan
  
  ## Sorun
  
  Admin kullanıcıları hakediş kayıtlarını göremiyordu çünkü RLS policy yanlış JWT path'i kullanıyordu.
  
  ## Çözüm
  
  Role bilgisi `app_metadata` içinde saklanıyor, doğrudan JWT root'unda değil.
*/

-- Admin invoices SELECT policy'yi güncelle
DROP POLICY IF EXISTS "Admin can view all invoices" ON invoices;

CREATE POLICY "Admin can view all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Admin invoices UPDATE policy'yi güncelle
DROP POLICY IF EXISTS "Admin can update invoices" ON invoices;

CREATE POLICY "Admin can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
