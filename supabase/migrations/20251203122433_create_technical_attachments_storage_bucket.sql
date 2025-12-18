/*
  # Technical Service Request Attachments Storage

  1. Storage Bucket
    - Create `technical-attachments` bucket for images and videos
    - Public bucket for viewing attachments
    - Support for images (jpg, png, gif, webp) and videos (mp4, mov, avi)

  2. Storage Policies
    - Authenticated users can upload attachments
    - Authenticated users can update their own attachments
    - Authenticated users can delete their own attachments
    - Anyone can view attachments (public access)
    - Admins can manage all attachments

  3. Security
    - File size limits enforced at application level
    - Only image and video file types allowed
*/

-- Create the technical-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'technical-attachments',
  'technical-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload technical attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own technical attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own technical attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view technical attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all technical attachments" ON storage.objects;

-- Allow authenticated users to upload attachments
CREATE POLICY "Users can upload technical attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technical-attachments'
);

-- Allow authenticated users to update their own attachments
CREATE POLICY "Users can update own technical attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'technical-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own attachments
CREATE POLICY "Users can delete own technical attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'technical-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view technical attachments (public bucket)
CREATE POLICY "Anyone can view technical attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'technical-attachments');

-- Allow admins to manage all technical attachments
CREATE POLICY "Admins can manage all technical attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'technical-attachments' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
