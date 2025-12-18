/*
  # qr_code_secret Kolonunu Nullable Yap

  1. Değişiklikler
    - `projects_greenco` tablosundaki `qr_code_secret` kolonu artık NULL değer alabilir
    - Yeni proje oluşturulurken QR kod otomatik oluşturulabilir veya boş bırakılabilir
*/

-- qr_code_secret kolonunu nullable yap
ALTER TABLE projects_greenco 
ALTER COLUMN qr_code_secret DROP NOT NULL;
