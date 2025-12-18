/*
  # Proje Atamalarına Ücret Kolonları Ekleme

  ## Değişiklikler
  
  ### Yeni Kolonlar
  - `hourly_rate` (numeric) - Saatlik ücret
  - `package_rate` (numeric) - Paket ücreti (aylık/dönemsel)
  
  ## Notlar
  
  Bu kolonlar personelin projeye atandığında belirlenen ücret bilgilerini saklar.
  Her iki alan da opsiyonel (NULL olabilir).
*/

-- Hourly rate kolonu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE project_assignments 
    ADD COLUMN hourly_rate numeric(10,2);
  END IF;
END $$;

-- Package rate kolonu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'package_rate'
  ) THEN
    ALTER TABLE project_assignments 
    ADD COLUMN package_rate numeric(10,2);
  END IF;
END $$;
