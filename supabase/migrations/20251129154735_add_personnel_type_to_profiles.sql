/*
  # Add personnel_type_id to profiles

  1. Changes
    - Add personnel_type_id column to profiles table
    - Add foreign key to personnel_types table
    - This allows filtering personnel by type directly from profiles
  
  2. Notes
    - Column is nullable as not all profiles are personnel
    - Only personnel role users will have this field populated
*/

-- Add personnel_type_id column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS personnel_type_id uuid REFERENCES personnel_types(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_personnel_type_id 
ON profiles(personnel_type_id);
