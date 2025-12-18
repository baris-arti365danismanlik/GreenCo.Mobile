/*
  # Auto-create profile on user signup

  1. Changes
    - Creates a trigger function to automatically create a profile when a user signs up
    - Trigger activates after user is inserted into auth.users
    - Extracts user metadata and creates profile with proper defaults
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates profile if one doesn't already exist
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create profile if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, full_name, phone, role, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'personnel'),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();