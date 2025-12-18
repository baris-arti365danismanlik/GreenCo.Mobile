/*
  # Create Technical Company Users from Technical Service Companies

  1. Purpose
    - Create auth.users and profiles for all technical service companies
    - Use phone number as login identifier
    - Set role as 'technical_company' in app_metadata
    - Link profiles to technical_service_companies table

  2. Process
    - For each company in technical_service_companies:
      - Create auth.users with phone number (E.164 format)
      - Set password to 'GreenCo2025!'
      - Set role to 'technical_company' in app_metadata
      - Create corresponding profile with company information
      - Link profile to technical_service_companies via technical_company_id

  3. Security
    - Uses service role permissions
    - Creates secure bcrypt password hashes
*/

-- Add technical_company_id to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'technical_company_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN technical_company_id uuid REFERENCES technical_service_companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Function to create technical company user
CREATE OR REPLACE FUNCTION create_technical_company_user(
  p_company_id uuid,
  p_company_name text,
  p_phone text,
  p_email text,
  p_location_city text,
  p_location_district text
) RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_phone_formatted text;
BEGIN
  -- Format phone to E.164 if not already
  IF p_phone LIKE '+%' THEN
    v_phone_formatted := p_phone;
  ELSIF p_phone LIKE '0%' THEN
    -- Turkish phone: 05321234567 -> +905321234567
    v_phone_formatted := '+9' || substring(p_phone from 2);
  ELSE
    -- Assume it needs +90 prefix
    v_phone_formatted := '+90' || p_phone;
  END IF;

  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE phone = v_phone_formatted;
  
  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists with phone %, skipping', v_phone_formatted;
    RETURN v_user_id;
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    phone,
    encrypted_password,
    email_confirmed_at,
    phone_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    p_email,
    v_phone_formatted,
    crypt('GreenCo2025!', gen_salt('bf')),
    now(),
    now(),
    jsonb_build_object('role', 'technical_company', 'provider', 'phone'),
    jsonb_build_object('full_name', p_company_name),
    now(),
    now(),
    'authenticated',
    'authenticated'
  ) RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO profiles (
    id,
    full_name,
    phone,
    location_city,
    location_district,
    technical_company_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_company_name,
    v_phone_formatted,
    p_location_city,
    p_location_district,
    p_company_id,
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create users for all technical service companies
DO $$
DECLARE
  company_record RECORD;
  created_user_id uuid;
BEGIN
  FOR company_record IN 
    SELECT id, company_name, phone, email, location_city, location_district
    FROM technical_service_companies
    WHERE is_active = true
    ORDER BY company_name
  LOOP
    BEGIN
      created_user_id := create_technical_company_user(
        company_record.id,
        company_record.company_name,
        company_record.phone,
        company_record.email,
        company_record.location_city,
        company_record.location_district
      );
      
      RAISE NOTICE 'Created user for company: % (ID: %)', 
        company_record.company_name, created_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating user for company %: %', 
        company_record.company_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Clean up the function
DROP FUNCTION IF EXISTS create_technical_company_user;
