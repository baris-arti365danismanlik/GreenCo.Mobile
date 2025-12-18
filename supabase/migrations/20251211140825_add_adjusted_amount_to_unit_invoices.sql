/*
  # Add Adjusted Amount to Unit Invoices
  
  1. Changes
    - Add `adjusted_amount` column to store the operations-adjusted amount
    - Add `adjustment_notes` column to store the reason for adjustment
    
  2. Notes
    - `adjusted_amount` is nullable - if NULL, use `total_amount`
    - When displaying, check `adjusted_amount` first, fallback to `total_amount`
*/

-- Add adjusted_amount and adjustment_notes columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unit_invoices' AND column_name = 'adjusted_amount'
  ) THEN
    ALTER TABLE unit_invoices ADD COLUMN adjusted_amount numeric;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'unit_invoices' AND column_name = 'adjustment_notes'
  ) THEN
    ALTER TABLE unit_invoices ADD COLUMN adjustment_notes text;
  END IF;
END $$;