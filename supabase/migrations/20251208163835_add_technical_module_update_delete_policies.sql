/*
  # Add UPDATE and DELETE policies for technical module users

  ## Changes
  - Add UPDATE policy for technical module users on technical_service_companies table
  - Add DELETE policy for technical module users on technical_service_companies table
  
  ## Security
  - Only users with 'technical' in their service_modules can update/delete companies
  - Uses JWT metadata to check permissions
*/

-- Drop if exists
DROP POLICY IF EXISTS "Technical module users can update companies" ON technical_service_companies;
DROP POLICY IF EXISTS "Technical module users can delete companies" ON technical_service_companies;

-- Technical module users can update technical service companies
CREATE POLICY "Technical module users can update companies"
  ON technical_service_companies
  FOR UPDATE
  TO authenticated
  USING (
    'technical' = ANY (
      COALESCE((
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(
            (auth.jwt() ->> 'app_metadata')::jsonb -> 'service_modules'
          )
        )
      ), ARRAY[]::text[])
    )
  )
  WITH CHECK (
    'technical' = ANY (
      COALESCE((
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(
            (auth.jwt() ->> 'app_metadata')::jsonb -> 'service_modules'
          )
        )
      ), ARRAY[]::text[])
    )
  );

-- Technical module users can delete technical service companies
CREATE POLICY "Technical module users can delete companies"
  ON technical_service_companies
  FOR DELETE
  TO authenticated
  USING (
    'technical' = ANY (
      COALESCE((
        SELECT ARRAY(
          SELECT jsonb_array_elements_text(
            (auth.jwt() ->> 'app_metadata')::jsonb -> 'service_modules'
          )
        )
      ), ARRAY[]::text[])
    )
  );
