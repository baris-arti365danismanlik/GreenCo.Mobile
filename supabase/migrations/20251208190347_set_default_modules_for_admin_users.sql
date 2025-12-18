/*
  # Admin Kullanıcıları İçin Varsayılan Modüller

  1. Değişiklikler
    - Admin kullanıcıları oluşturulduğunda otomatik olarak hem 'personnel' hem 'technical' modüllerine sahip olacak
    - Mevcut admin kullanıcıları güncellenmiş durumda (önceki sorgu ile)
    
  2. Trigger
    - Yeni bir profil oluşturulduğunda veya güncellendiğinde
    - Eğer rol 'admin' ise ve service_modules boşsa
    - Otomatik olarak her iki modülü ekler
*/

-- Create or replace function to set default modules for admin users
CREATE OR REPLACE FUNCTION set_admin_default_modules()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is admin and service_modules is empty or null
  IF NEW.role = 'admin' AND (NEW.service_modules IS NULL OR array_length(NEW.service_modules, 1) IS NULL OR array_length(NEW.service_modules, 1) = 0) THEN
    NEW.service_modules := ARRAY['personnel', 'technical']::text[];
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_set_admin_default_modules ON profiles;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_set_admin_default_modules
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_admin_default_modules();
