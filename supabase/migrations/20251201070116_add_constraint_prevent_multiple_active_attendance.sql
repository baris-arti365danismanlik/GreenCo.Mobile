/*
  # Aynı Anda Birden Fazla Mesaide Kaydını Engelle

  1. Değişiklikler
    - `attendance_records` tablosuna unique partial index ekleniyor
    - Bir personel çıkış yapmadan başka bir yere giriş yapamaz
    - Sadece `check_out_time IS NULL` olan kayıtlar kontrol edilir
  
  2. Güvenlik
    - Veri bütünlüğü korunur
    - Mantıksal hatalar önlenir
    - Bir personel aynı anda sadece bir projede mesaide olabilir
*/

-- Bir personel aynı anda sadece bir yerde mesaide olabilir
-- check_out_time NULL olan (yani hala mesaide olan) kayıtlar için
-- her worker_id sadece bir kez olabilir
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_attendance_per_worker
  ON attendance_records (worker_id)
  WHERE check_out_time IS NULL;
