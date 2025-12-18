-- Create admin user with phone authentication
-- Note: This creates a user in auth.users table with phone number
-- Phone: +905551111111
-- Password: admin123

-- First, we'll create the auth user
-- This needs to be done through the Supabase dashboard or using the admin API
-- because we can't directly insert into auth.users via SQL for security reasons

-- After creating the user through admin panel, we can create the profile:
-- Replace 'USER_ID_HERE' with the actual user ID from auth.users

INSERT INTO profiles (id, full_name, phone, role, is_active)
VALUES (
  'USER_ID_HERE',
  'Admin',
  '+905551111111',
  'admin',
  true
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;
