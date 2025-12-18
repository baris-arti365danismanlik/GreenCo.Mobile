/*
  # Create personnel_types table for dynamic job types

  1. New Tables
    - `personnel_types`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Job type name (e.g., 'Temizlik', 'Garson', 'Cam Silme')
      - `created_at` (timestamptz)
      - `created_by` (uuid) - User who created this type
      - `is_active` (boolean) - Whether this type is active

  2. Security
    - Enable RLS on `personnel_types` table
    - Authenticated users can read all active personnel types
    - Only admins and operations can create new personnel types
    - Only admins can update or delete personnel types

  3. Initial Data
    - Seed with common cleaning and catering job types
*/

CREATE TABLE IF NOT EXISTS personnel_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true
);

ALTER TABLE personnel_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read active personnel types
CREATE POLICY "Authenticated users can view active personnel types"
  ON personnel_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins and operations can create new personnel types
CREATE POLICY "Admins and operations can create personnel types"
  ON personnel_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operations')
  );

-- Only admins can update personnel types
CREATE POLICY "Admins can update personnel types"
  ON personnel_types
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Only admins can delete personnel types
CREATE POLICY "Admins can delete personnel types"
  ON personnel_types
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Insert common cleaning and catering job types
INSERT INTO personnel_types (name, is_active) VALUES
  ('Temizlik Personeli', true),
  ('Cam Silme Personeli', true),
  ('İkram Personeli', true),
  ('Garson', true),
  ('Bulaşıkçı', true),
  ('Aşçı', true),
  ('Aşçı Yardımcısı', true),
  ('Komi', true),
  ('Şef', true),
  ('Barista', true),
  ('Bar Personeli', true),
  ('Kafe Çalışanı', true),
  ('Servis Elemanı', true),
  ('Mutfak Personeli', true),
  ('Hijyen Görevlisi', true)
ON CONFLICT (name) DO NOTHING;
