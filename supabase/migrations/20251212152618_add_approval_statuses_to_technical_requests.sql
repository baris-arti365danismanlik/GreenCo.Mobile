/*
  # Teknik Servis Onay Durumları

  ## Değişiklikler

  1. Yeni Status'lar
    - `awaiting_pm_approval` - PM onayı bekleniyor
    - `awaiting_operations_approval` - Operations onayı bekleniyor

  ## Açıklama

  İş akışı:
  1. Firma işi tamamlar → status: awaiting_pm_approval
  2. PM onaylar → status: awaiting_operations_approval
  3. Operations onaylar → status: completed
*/

-- Add new statuses to technical_service_request_status enum
DO $$ BEGIN
  ALTER TYPE technical_service_request_status ADD VALUE IF NOT EXISTS 'awaiting_pm_approval';
  ALTER TYPE technical_service_request_status ADD VALUE IF NOT EXISTS 'awaiting_operations_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
