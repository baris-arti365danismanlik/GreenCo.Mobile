/*
  # Puantaj Sistemi İyileştirmeleri

  1. Değişiklikler
    - timesheet_status enum'a 'rejected_manager' durumu eklendi
    - Proje yöneticilerinin hangi projelere atandığını görmek için zaten project_managers tablosu var
    
  2. Notlar
    - Status değerleri: draft, pending_manager, approved_manager, rejected_manager, final_approved
    - Proje yöneticisi atamaları project_managers tablosu ile yapılıyor
*/

-- rejected_manager status'ünü ekle
ALTER TYPE timesheet_status ADD VALUE IF NOT EXISTS 'rejected_manager';

-- timesheet_periods tablosuna rejection_note alanı ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_periods' AND column_name = 'manager_rejected_at'
  ) THEN
    ALTER TABLE timesheet_periods ADD COLUMN manager_rejected_at timestamptz;
  END IF;
END $$;

-- Proje yöneticisi atamaları için unique constraint ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_project_manager_assignment'
  ) THEN
    ALTER TABLE project_managers 
    ADD CONSTRAINT unique_project_manager_assignment 
    UNIQUE (project_id, manager_id);
  END IF;
END $$;
