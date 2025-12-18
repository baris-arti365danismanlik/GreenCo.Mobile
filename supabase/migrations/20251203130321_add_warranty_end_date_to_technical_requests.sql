/*
  # Teknik Taleplere Garanti Bitiş Tarihi Ekle

  1. Değişiklikler
    - `technical_service_requests` tablosuna `warranty_end_date` alanı eklendi
      - Tip: date (nullable)
      - Açıklama: Varlık garanti bitiş tarihi (asset_based kategoriler için)
    
  2. Notlar
    - Bu alan sadece asset_based (varlık bazlı) kategoriler için kullanılır
    - Yeni varlık kodu girildiğinde: seri no, model ve garanti tarihi birlikte girilir
    - Mevcut varlık seçildiğinde: tüm bilgiler otomatik doldurulur
*/

ALTER TABLE technical_service_requests
ADD COLUMN IF NOT EXISTS warranty_end_date date;