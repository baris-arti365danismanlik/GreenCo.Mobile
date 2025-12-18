/*
  # Proje Tarihlerini Ekle

  1. Değişiklikler
    - `projects_greenco` tablosuna `start_date` ve `end_date` kolonları eklendi
    - Bu kolonlar proje başlangıç ve bitiş tarihlerini tutar
    - Nullable olarak eklendi (mevcut projeler için)
*/

-- start_date kolonu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects_greenco' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE projects_greenco ADD COLUMN start_date date;
  END IF;
END $$;

-- end_date kolonu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects_greenco' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE projects_greenco ADD COLUMN end_date date;
  END IF;
END $$;
