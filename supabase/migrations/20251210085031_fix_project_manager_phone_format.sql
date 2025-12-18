/*
  # Fix Project Manager Phone Format

  Standardizes phone number and email format for user 5558966552
  - Updates phone from '5558966552' to '+905558966552'
  - Updates email from '5558966552@greenco.app' to '905558966552@greenco.app'
  - Updates password to 'GreenCo2025!'
*/

-- Update the phone number in profiles
UPDATE profiles
SET phone = '+905558966552'
WHERE phone = '5558966552';

-- Update the email in auth.users
UPDATE auth.users
SET 
  email = '905558966552@greenco.app',
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    '"905558966552@greenco.app"'
  ),
  encrypted_password = crypt('GreenCo2025!', gen_salt('bf')),
  updated_at = now()
WHERE email = '5558966552@greenco.app';
