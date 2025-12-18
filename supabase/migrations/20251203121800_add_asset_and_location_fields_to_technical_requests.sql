/*
  # Technical Service Requests - Varlık ve Lokasyon Alanları

  1. Yeni Alanlar
    - Asset-Based (Varlık Bazlı) kategoriler için:
      - `asset_code` (text, nullable) - Varlık kodu (örn: AC-001)
      - `serial_number` (text, nullable) - Cihaz seri numarası
      - `model` (text, nullable) - Cihaz modeli
    
    - Location-Based (Lokasyon Bazlı) kategoriler için:
      - `room_area` (text, nullable) - Oda/Alan bilgisi (örn: Toplantı Odası A)
      - `floor` (text, nullable) - Kat bilgisi (örn: 3. Kat)

  2. Notlar
    - Tüm alanlar nullable çünkü hizmet tipine göre sadece ilgili alanlar doldurulur
    - asset_based ise: asset_code, serial_number, model kullanılır
    - location_based ise: room_area, floor kullanılır
*/

-- Asset-Based kategoriler için alanlar
ALTER TABLE technical_service_requests
ADD COLUMN IF NOT EXISTS asset_code text,
ADD COLUMN IF NOT EXISTS serial_number text,
ADD COLUMN IF NOT EXISTS model text;

-- Location-Based kategoriler için alanlar
ALTER TABLE technical_service_requests
ADD COLUMN IF NOT EXISTS room_area text,
ADD COLUMN IF NOT EXISTS floor text;
