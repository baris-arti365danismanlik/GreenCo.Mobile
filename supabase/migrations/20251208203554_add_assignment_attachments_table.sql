/*
  # Add assignment attachments table
  
  1. New Tables
    - `technical_service_assignment_attachments`
      - `id` (uuid, primary key)
      - `assignment_id` (uuid, foreign key to technical_service_assignments)
      - `file_name` (text) - Original file name
      - `file_path` (text) - Path in storage
      - `file_type` (text) - image or video
      - `file_size` (integer) - Size in bytes
      - `uploaded_by` (uuid) - User who uploaded
      - `caption` (text, optional) - Description/caption
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Technical companies can insert/view/delete their own assignment attachments
    - Admin and operations can view all
*/

CREATE TABLE IF NOT EXISTS technical_service_assignment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES technical_service_assignments(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size integer,
  uploaded_by uuid REFERENCES auth.users(id),
  caption text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE technical_service_assignment_attachments ENABLE ROW LEVEL SECURITY;

-- Technical companies can manage attachments for their assignments
CREATE POLICY "Technical companies can insert attachments for their assignments"
  ON technical_service_assignment_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM technical_service_assignments tsa
      WHERE tsa.id = assignment_id
      AND tsa.company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
      AND ((auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company')
    )
  );

CREATE POLICY "Technical companies can view attachments for their assignments"
  ON technical_service_assignment_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM technical_service_assignments tsa
      WHERE tsa.id = assignment_id
      AND tsa.company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
      AND ((auth.jwt() -> 'app_metadata' ->> 'role') = 'technical_company')
    )
  );

CREATE POLICY "Technical companies can delete their attachments"
  ON technical_service_assignment_attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM technical_service_assignments tsa
      WHERE tsa.id = assignment_id
      AND tsa.company_id = ((auth.jwt() -> 'app_metadata' ->> 'technical_company_id')::uuid)
    )
  );

-- Admin and operations can view all attachments
CREATE POLICY "Admin and operations can view all attachments"
  ON technical_service_assignment_attachments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'operations')
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment_id 
  ON technical_service_assignment_attachments(assignment_id);
