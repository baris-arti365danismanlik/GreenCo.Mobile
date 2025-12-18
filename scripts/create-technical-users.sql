/*
  Create Technical Module Users Pool

  This script creates a pool of users for the technical services module:
  - Operations users (can create requests)
  - Project managers (can review and approve requests)

  Phone numbers: +9054XXXX1001 to +9054XXXX1010
  Password for all: GreenCo2025!
*/

-- Create Operations Users (can create technical service requests)
DO $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  -- Operations User 1
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'ops1@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905451111001',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"operations"}',
    '{"full_name":"Ahmet Yılmaz"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Ahmet Yılmaz', '+905451111001', 'operations', ARRAY['technical']);

  -- Operations User 2
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'ops2@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905451111002',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"operations"}',
    '{"full_name":"Mehmet Kaya"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Mehmet Kaya', '+905451111002', 'operations', ARRAY['technical']);

  -- Operations User 3
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'ops3@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905451111003',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"operations"}',
    '{"full_name":"Ayşe Demir"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Ayşe Demir', '+905451111003', 'operations', ARRAY['technical']);

  -- Operations User 4
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'ops4@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905451111004',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"operations"}',
    '{"full_name":"Fatma Şahin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Fatma Şahin', '+905451111004', 'operations', ARRAY['technical']);

  -- Operations User 5
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'ops5@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905451111005',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"operations"}',
    '{"full_name":"Ali Yıldız"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Ali Yıldız', '+905451111005', 'operations', ARRAY['technical']);

  -- Project Manager 1
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'pm1@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905452222001',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"project_manager"}',
    '{"full_name":"Hasan Çelik"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Hasan Çelik', '+905452222001', 'project_manager', ARRAY['technical']);

  -- Project Manager 2
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'pm2@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905452222002',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"project_manager"}',
    '{"full_name":"Zeynep Arslan"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Zeynep Arslan', '+905452222002', 'project_manager', ARRAY['technical']);

  -- Project Manager 3
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'pm3@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905452222003',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"project_manager"}',
    '{"full_name":"Murat Öztürk"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Murat Öztürk', '+905452222003', 'project_manager', ARRAY['technical']);

  -- Project Manager 4
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'pm4@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905452222004',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"project_manager"}',
    '{"full_name":"Elif Aydın"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Elif Aydın', '+905452222004', 'project_manager', ARRAY['technical']);

  -- Project Manager 5
  INSERT INTO auth.users (
    id,
    instance_id,
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
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'pm5@greenco.com',
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    '+905452222005',
    now(),
    '{"provider":"phone","providers":["phone"],"role":"project_manager"}',
    '{"full_name":"Can Yılmaz"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_user_id;

  INSERT INTO profiles (id, full_name, phone, role, service_modules)
  VALUES (v_user_id, 'Can Yılmaz', '+905452222005', 'project_manager', ARRAY['technical']);

  RAISE NOTICE 'Technical users created successfully!';
  RAISE NOTICE 'Operations users: 5 (Ahmet, Mehmet, Ayşe, Fatma, Ali)';
  RAISE NOTICE 'Project Managers: 5 (Hasan, Zeynep, Murat, Elif, Can)';
  RAISE NOTICE 'All passwords: GreenCo2025!';
END $$;
