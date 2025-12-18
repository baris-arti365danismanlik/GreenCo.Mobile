/*
  # Add Profile Images and Location Fields

  1. Changes to `profiles` table
    - Add `avatar_url` (text, nullable) - Profile image URL or storage path
    - Add `city` (text, nullable) - City information
    - Add `district` (text, nullable) - District information
    - Add `last_qr_scan_at` (timestamptz, nullable) - Last QR code scan timestamp
    
  2. Notes
    - Profile images will be stored in Supabase Storage
    - City/district will be text fields for flexibility
    - `last_qr_scan_at` will be updated when QR codes are scanned
    - Active status can be determined by recent QR scans
*/

-- Add new columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'district'
  ) THEN
    ALTER TABLE profiles ADD COLUMN district text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_qr_scan_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_qr_scan_at timestamptz;
  END IF;
END $$;

-- Create index for QR scan queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_qr_scan 
  ON profiles(last_qr_scan_at DESC);

-- Create index for location queries
CREATE INDEX IF NOT EXISTS idx_profiles_location 
  ON profiles(city, district) 
  WHERE role = 'personnel';
