/*
  # Add Bid Types to Technical Service Bids
  
  ## Changes
  
  1. Enums
    - Create `bid_type_enum` with three values:
      - `quote`: Standard price quote (mevcut davranış - teklif)
      - `info_request`: Request for additional information (ek bilgi talebi)
      - `diagnostic_service`: Service for problem diagnosis (sorun tespiti servisi)
  
  2. Tables Modified
    - `technical_service_bids`
      - Add `bid_type` column (enum, default 'quote')
      - Make `bid_amount` nullable (bilgi talebinde tutar gerekmez)
      - Make `estimated_duration` nullable (bilgi talebinde süre gerekmez)
      - Keep `description` for notes/explanations
      - Remove old `needs_more_info` and `info_request_message` (replaced by bid_type)
  
  3. Notes
    - Existing bids will default to 'quote' type
    - For 'quote': bid_amount + estimated_duration + description required
    - For 'diagnostic_service': bid_amount (servis ücreti) + description required
    - For 'info_request': only description required (hangi bilgi gerekiyor)
*/

-- Create bid type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bid_type_enum') THEN
    CREATE TYPE bid_type_enum AS ENUM ('quote', 'info_request', 'diagnostic_service');
  END IF;
END $$;

-- Add bid_type column to technical_service_bids
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_service_bids' AND column_name = 'bid_type'
  ) THEN
    ALTER TABLE technical_service_bids 
    ADD COLUMN bid_type bid_type_enum DEFAULT 'quote' NOT NULL;
  END IF;
END $$;

-- Make bid_amount nullable
ALTER TABLE technical_service_bids 
ALTER COLUMN bid_amount DROP NOT NULL;

-- Make estimated_duration nullable
ALTER TABLE technical_service_bids 
ALTER COLUMN estimated_duration DROP NOT NULL;

-- Drop old columns that are replaced by bid_type system
ALTER TABLE technical_service_bids 
DROP COLUMN IF EXISTS needs_more_info,
DROP COLUMN IF EXISTS info_request_message;

-- Add check constraint: amount required for quote and diagnostic_service
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bid_amount_required_for_quote_and_diagnostic'
  ) THEN
    ALTER TABLE technical_service_bids
    ADD CONSTRAINT bid_amount_required_for_quote_and_diagnostic
    CHECK (
      (bid_type = 'info_request') OR
      (bid_type IN ('quote', 'diagnostic_service') AND bid_amount IS NOT NULL)
    );
  END IF;
END $$;

-- Add check constraint: estimated_duration required for quote
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'estimated_duration_required_for_quote'
  ) THEN
    ALTER TABLE technical_service_bids
    ADD CONSTRAINT estimated_duration_required_for_quote
    CHECK (
      (bid_type IN ('info_request', 'diagnostic_service')) OR
      (bid_type = 'quote' AND estimated_duration IS NOT NULL)
    );
  END IF;
END $$;