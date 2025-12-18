/*
  # Operasyon RLS Politikalarını Düzelt

  ## Sorun
  
  - Yeni eklediğimiz politikalar `auth.jwt() ->> 'role'` kullanıyor
  - Ama role aslında `auth.jwt() -> 'app_metadata' ->> 'role'` içinde
  - Bu yüzden operasyon kullanıcıları veri göremiyor

  ## Çözüm
  
  - Tüm operasyon RLS politikalarını doğru JWT path ile güncelle
  - `auth.jwt() -> 'app_metadata' ->> 'role'` kullan

  ## Değişiklikler
  
  - timesheet_periods: Operations politikası güncellendi
  - invoices: Operations politikası güncellendi  
  - attendance_records: Operations politikası güncellendi
*/

-- timesheet_periods için düzelt
DROP POLICY IF EXISTS "Operations can view finalized timesheets" ON timesheet_periods;

CREATE POLICY "Operations can view finalized timesheets"
  ON timesheet_periods FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operations')
    AND status IN ('final_approved', 'invoice_pending', 'invoice_completed')
  );

-- invoices için düzelt
DROP POLICY IF EXISTS "Operations can view all invoices" ON invoices;

CREATE POLICY "Operations can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operations');

-- invoices insert politikasını da düzelt
DROP POLICY IF EXISTS "Operations can create invoices" ON invoices;

CREATE POLICY "Operations can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operations');

-- attendance_records için düzelt
DROP POLICY IF EXISTS "Operations can view all attendance records" ON attendance_records;

CREATE POLICY "Operations can view all attendance records"
  ON attendance_records FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operations');
