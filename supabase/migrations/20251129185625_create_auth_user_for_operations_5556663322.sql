/*
  # Operations Kullanıcısı için Auth Kaydı Oluştur

  1. Değişiklikler
    - 5556663322 telefon numaralı operations kullanıcısı için auth kaydı oluşturuldu
    - Profil zaten var, sadece auth.users tablosuna kayıt eklendi
    
  2. Güvenlik
    - Şifre bcrypt ile hash'lendi
    - Role metadata'ya eklendi
*/

-- Auth kullanıcısı oluştur (ID profildeki ile aynı)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  'fae454e2-c1f2-4d7a-b50c-e6342b521431'::uuid,
  'authenticated',
  'authenticated',
  '905556663322@greenco.app',
  crypt('123456', gen_salt('bf')),
  NOW(),
  jsonb_build_object('role', 'operations'),
  jsonb_build_object('full_name', 'daad fdafs af'),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'fae454e2-c1f2-4d7a-b50c-e6342b521431'
);

-- Auth identity oluştur
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  'fae454e2-c1f2-4d7a-b50c-e6342b521431'::uuid,
  'fae454e2-c1f2-4d7a-b50c-e6342b521431'::uuid,
  jsonb_build_object(
    'sub', 'fae454e2-c1f2-4d7a-b50c-e6342b521431',
    'email', '905556663322@greenco.app'
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities WHERE user_id = 'fae454e2-c1f2-4d7a-b50c-e6342b521431'
);
