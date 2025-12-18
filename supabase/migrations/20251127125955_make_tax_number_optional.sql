/*
  # Make tax_number optional in companies table

  1. Changes
    - Alter `companies` table to make `tax_number` column nullable
    - This allows companies to be created without a tax number

  2. Notes
    - Tax number is no longer required for company creation
    - Existing data is preserved
*/

ALTER TABLE companies 
ALTER COLUMN tax_number DROP NOT NULL;
