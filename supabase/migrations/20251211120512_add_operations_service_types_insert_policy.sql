/*
  # Operations Hizmet Türü Ekleme İzni

  ## Değişiklikler
  
  Operations kullanıcıları da yeni hizmet türleri ekleyebilsin
  
  ## Güvenlik
  
  - Operations rolü service_types tablosuna INSERT yapabilir
*/

-- Operations: Yeni hizmet türü ekleyebilir
CREATE POLICY "Operations can insert service types"
  ON service_types FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'app_metadata')::jsonb->>'role' = 'operations');
