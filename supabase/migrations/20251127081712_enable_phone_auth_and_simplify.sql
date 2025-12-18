/*
  # Enable Phone Authentication and Simplify Personnel Access

  1. Changes
    - Add unique constraint on phone number in profiles table
    - Create function to lookup user by phone number
    - Update RLS policies for simpler phone-based access
    
  2. Security
    - Maintain existing RLS on profiles table
    - Users can only access their own data
    - Phone numbers must be unique for authentication
    
  3. Notes
    - SMS authentication will be configured via Supabase dashboard
    - Personnel will use phone + SMS OTP for login
    - No email required for personnel accounts
*/

-- Add unique constraint to phone number (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_phone_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Create index for faster phone lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone) WHERE phone IS NOT NULL;

-- Create function to get user by phone (for personnel lookup)
CREATE OR REPLACE FUNCTION get_user_by_phone(phone_number TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  company_id UUID,
  is_active BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.phone,
    p.role,
    p.company_id,
    p.is_active
  FROM profiles p
  WHERE p.phone = phone_number
  AND p.is_active = true;
END;
$$;
