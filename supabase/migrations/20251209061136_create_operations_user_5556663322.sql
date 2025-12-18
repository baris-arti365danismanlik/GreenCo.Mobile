/*
  # Operations Kullanıcısı Oluşturma
  
  5556663322 numaralı telefon ile operations kullanıcısı oluşturuluyor.
  
  1. Auth kullanıcısı oluşturma
  2. Profile kaydı oluşturma
  3. Şifre: GreenCo2025!
*/

-- Create the operations user with proper metadata
DO $$
DECLARE
  new_user_id uuid;
  hashed_password text;
BEGIN
  -- Generate user ID
  new_user_id := gen_random_uuid();
  
  -- Hash the password
  hashed_password := crypt('GreenCo2025!', gen_salt('bf'));
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    '905556663322@greenco.app',
    hashed_password,
    NOW(),
    '+905556663322',
    NOW(),
    jsonb_build_object('role', 'operations', 'service_modules', ARRAY['personnel', 'technical_service']),
    jsonb_build_object('full_name', 'Operations'),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (id) DO NOTHING;
  
  -- Insert or update profile
  INSERT INTO profiles (
    id,
    full_name,
    phone,
    role,
    service_modules,
    is_active
  ) VALUES (
    new_user_id,
    'Operations',
    '+905556663322',
    'operations',
    ARRAY['personnel', 'technical_service'],
    true
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    service_modules = EXCLUDED.service_modules,
    is_active = EXCLUDED.is_active;
    
  RAISE NOTICE 'Operations user created with ID: %', new_user_id;
END $$;
