/*
  # company_id Kolonunu Nullable Yap

  1. Değişiklikler
    - `projects_greenco` tablosundaki `company_id` kolonu artık NULL değer alabilir
    - Yeni proje oluşturulurken company_id opsiyonel olacak
*/

-- company_id kolonunu nullable yap
ALTER TABLE projects_greenco 
ALTER COLUMN company_id DROP NOT NULL;
