/*
  # Proje Atamalarına Ücret Bilgilerini Ekle

  ## Değişiklikler
  
  ### `project_assignments` tablosu
  - `daily_rate` (numeric) - Günlük ücret (TL)
  - `overtime_rate` (numeric) - Fazla mesai saatlik ücret (TL)
  - `position_title` (text) - Pozisyon adı (Aşçı, Garson, Bulaşıkçı, vs)
  - `standard_hours` (numeric) - Standart günlük saat (default: 8)
  
  ## İş Akışı
  
  1. Personel projeye atanırken:
     - Pozisyon seçilir
     - Günlük ücret girilir
     - Fazla mesai ücreti girilir
     - Standart saat belirlenir (genelde 8 saat)
  
  2. Hakediş hesaplama:
     - Normal gün: daily_rate × çalışılan gün sayısı
     - Fazla mesai: overtime_rate × (toplam_saat - (gün × standard_hours))
     - TOPLAM: normal gün tutarı + fazla mesai tutarı
  
  ## Örnek
  
  Aşçı:
  - Günlük ücret: 1,200 TL
  - Fazla mesai: 150 TL/saat
  - Standart saat: 8 saat/gün
  
  5 gün çalışma, 50 saat toplam:
  - Normal: 5 × 1,200 = 6,000 TL
  - Standart: 5 × 8 = 40 saat
  - Fazla mesai: 50 - 40 = 10 saat
  - Fazla mesai tutarı: 10 × 150 = 1,500 TL
  - TOPLAM: 6,000 + 1,500 = 7,500 TL
  
  ## Notlar
  
  - Eski sistemde `profiles.hourly_rate` vardı, artık kullanılmayacak
  - Her proje ataması kendi ücretlerini taşır
  - Aynı personel farklı projelerde farklı ücretler alabilir
*/

-- project_assignments tablosuna yeni alanlar ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'daily_rate'
  ) THEN
    ALTER TABLE project_assignments ADD COLUMN daily_rate numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'overtime_rate'
  ) THEN
    ALTER TABLE project_assignments ADD COLUMN overtime_rate numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'position_title'
  ) THEN
    ALTER TABLE project_assignments ADD COLUMN position_title text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_assignments' AND column_name = 'standard_hours'
  ) THEN
    ALTER TABLE project_assignments ADD COLUMN standard_hours numeric(4,1) DEFAULT 8.0;
  END IF;
END $$;

-- Test için mevcut atamalara örnek ücretler ekle
UPDATE project_assignments pa
SET 
  daily_rate = CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = pa.personnel_id 
      AND p.full_name LIKE 'aşçı%'
    ) THEN 1200.00
    ELSE 800.00
  END,
  overtime_rate = CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = pa.personnel_id 
      AND p.full_name LIKE 'aşçı%'
    ) THEN 150.00
    ELSE 100.00
  END,
  position_title = CASE
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = pa.personnel_id 
      AND p.full_name LIKE 'aşçı%'
    ) THEN 'Aşçı'
    ELSE 'Personel'
  END,
  standard_hours = 8.0
WHERE daily_rate = 0 OR daily_rate IS NULL;

-- Mevcut atamaları kontrol et
SELECT 
  pa.id,
  p.full_name,
  pa.position_title,
  pa.daily_rate,
  pa.overtime_rate,
  pa.standard_hours,
  proj.name as project_name
FROM project_assignments pa
LEFT JOIN profiles p ON pa.personnel_id = p.id
LEFT JOIN projects_greenco proj ON pa.project_id = proj.id
LIMIT 10;
