/*
  # TC Kimlik No ve Doğum Tarihi Ekleme

  1. Değişiklikler
    - `profiles` tablosuna `tc_identity_no` (TC Kimlik Numarası) alanı eklenir
    - `profiles` tablosuna `birth_date` (Doğum Tarihi) alanı eklenir (zaten var mı kontrol edilir)
    
  2. Kısıtlamalar
    - `tc_identity_no` UNIQUE olmalı (aynı TC ile birden fazla hesap açılamaz)
    - `tc_identity_no` sadece personel için zorunlu
    - 11 haneli rakam kontrolü
    
  3. Güvenlik
    - Mevcut RLS politikaları geçerli kalır
    
  4. Notlar
    - Mevcut kullanıcılar için NULL olabilir (eski kayıtlar)
    - Yeni personel kayıtları için UI'da zorunlu yapılacak
*/

-- TC Kimlik No alanı ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tc_identity_no'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tc_identity_no text UNIQUE;
    
    -- TC Kimlik No 11 haneli olmalı kontrolü
    ALTER TABLE profiles ADD CONSTRAINT tc_identity_no_length 
      CHECK (tc_identity_no IS NULL OR length(tc_identity_no) = 11);
    
    -- Sadece rakam olmalı kontrolü
    ALTER TABLE profiles ADD CONSTRAINT tc_identity_no_numeric 
      CHECK (tc_identity_no IS NULL OR tc_identity_no ~ '^[0-9]{11}$');
  END IF;
END $$;

-- Doğum tarihi alanı ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN birth_date date;
  END IF;
END $$;

-- Index ekle (TC Kimlik No ile arama hızlandırma)
CREATE INDEX IF NOT EXISTS idx_profiles_tc_identity_no ON profiles(tc_identity_no);

-- Yaş kontrolü (18 yaşından büyük olmalı)
ALTER TABLE profiles ADD CONSTRAINT birth_date_min_age 
  CHECK (birth_date IS NULL OR birth_date <= (CURRENT_DATE - INTERVAL '18 years'));
