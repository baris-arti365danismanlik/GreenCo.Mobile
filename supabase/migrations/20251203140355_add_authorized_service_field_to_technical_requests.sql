/*
  # Add Authorized Service Field to Technical Requests

  1. Changes
    - Add `send_to_authorized_service` boolean field to `technical_service_requests` table
      - Default value: false
      - This field indicates whether the user wants the request to be handled by authorized service
      - Used when warranty is still valid

  2. Notes
    - Non-breaking change - existing records will have default value (false)
    - Field is nullable to support older records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_requests' AND column_name = 'send_to_authorized_service'
  ) THEN
    ALTER TABLE technical_service_requests 
    ADD COLUMN send_to_authorized_service boolean DEFAULT false;
  END IF;
END $$;