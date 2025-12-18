/*
  # Add personnel_type_id to personnel table

  1. Changes
    - Add `personnel_type_id` column to personnel table
    - Add foreign key constraint to personnel_types table
    - Keep existing `position` field for custom/additional position info

  2. Notes
    - `personnel_type_id` references the standardized job type
    - `position` can still be used for additional details
    - Existing records will have NULL personnel_type_id initially
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personnel' AND column_name = 'personnel_type_id'
  ) THEN
    ALTER TABLE personnel ADD COLUMN personnel_type_id uuid REFERENCES personnel_types(id);
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_personnel_type_id ON personnel(personnel_type_id);
