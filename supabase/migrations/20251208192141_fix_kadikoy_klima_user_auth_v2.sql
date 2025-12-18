/*
  # kadıköyklima1 Kullanıcı Auth Düzeltmesi

  1. Değişiklikler
    - Auth.users'daki yanlış email'i düzelt: 9005339632369@greenco.app → 905339632369@greenco.app
    - App metadata'yı güncelle
    - Profiles'da yeni kayıt oluştur (düzeltilmiş telefon numarası ile)
  
  2. Güvenlik
    - Service role yetkileriyle auth.users güncelleniyor
*/

-- Auth.users'daki email ve metadata'yı düzelt
UPDATE auth.users
SET 
    email = '905339632369@greenco.app',
    raw_app_meta_data = jsonb_build_object(
      'role', 'technical_company',
      'technical_company_id', '609ce876-b464-4386-8121-126e0a58cf3f'
    ),
    updated_at = now()
WHERE id = '6902dbc4-2f43-4ecf-ac8a-891d8a60163b';

-- Profiles'da yeni kayıt oluştur
INSERT INTO profiles (
  id,
  full_name,
  phone,
  city,
  district,
  role,
  technical_company_id,
  is_active
) VALUES (
  '6902dbc4-2f43-4ecf-ac8a-891d8a60163b',
  'kadıköyklima1',
  '+905339632369',
  'İstanbul',
  'Kadıköy',
  'technical_company',
  '609ce876-b464-4386-8121-126e0a58cf3f',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  district = EXCLUDED.district,
  role = EXCLUDED.role,
  technical_company_id = EXCLUDED.technical_company_id,
  is_active = EXCLUDED.is_active;
