/*
  # Operasyon Kullanıcıları için RLS Politikaları

  ## Değişiklikler
  
  ### `timesheet_periods` tablosu
  - Operasyon kullanıcıları kesinleşmiş puantajları (final_approved, invoice_pending, invoice_completed) görüntüleyebilir
  
  ### `invoices` tablosu
  - Mevcut politikalar kontrol edildi
  - Operasyon kendi oluşturduğu hakediş kayıtlarını görebilir (zaten var)
  - Ek olarak: Operasyon TÜM hakediş kayıtlarını görebilir (iş gereksinimi)

  ## Notlar
  
  - Operasyon kullanıcıları sadece kesinleşmiş puantajları görebilir
  - Operasyon kullanıcıları tüm hakediş kayıtlarını görüntüleyebilir (muhasebe/takip için)
*/

-- Operasyon kullanıcıları kesinleşmiş puantajları görüntüleyebilir
CREATE POLICY "Operations can view finalized timesheets"
  ON timesheet_periods FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'operations'
    AND status IN ('final_approved', 'invoice_pending', 'invoice_completed')
  );

-- Operasyon kullanıcıları TÜM hakediş kayıtlarını görebilir (muhasebe/takip için)
DROP POLICY IF EXISTS "Operations can view own invoices" ON invoices;

CREATE POLICY "Operations can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'operations');
