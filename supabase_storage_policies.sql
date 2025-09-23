-- Supabase Storage Policies for insurevis-documents bucket
-- Run these commands in your Supabase SQL Editor to allow anonymous uploads

-- First, make sure the bucket exists (you mentioned you already created it)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('insurevis-documents', 'insurevis-documents', false);

-- Enable RLS on storage.objects table (this is usually enabled by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous users to upload files to the insurevis-documents bucket
CREATE POLICY "Allow anonymous uploads to insurevis-documents bucket" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'insurevis-documents');

-- Create policy to allow anonymous users to read files from the insurevis-documents bucket  
CREATE POLICY "Allow anonymous downloads from insurevis-documents bucket" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'insurevis-documents');

-- Create policy to allow anonymous users to update files (if needed)
CREATE POLICY "Allow anonymous updates to insurevis-documents bucket" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'insurevis-documents')
  WITH CHECK (bucket_id = 'insurevis-documents');

-- Create policy to allow anonymous users to delete files (if needed)
CREATE POLICY "Allow anonymous deletes from insurevis-documents bucket" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'insurevis-documents');

-- Alternative: If you want to be more restrictive, you could create policies based on file paths
-- For example, only allow uploads to specific folders:

-- CREATE POLICY "Allow anonymous uploads to documents folder" ON storage.objects
--   FOR INSERT TO anon
--   WITH CHECK (bucket_id = 'insurevis-documents' AND name LIKE 'documents/%');

-- CREATE POLICY "Allow anonymous uploads to assessments folder" ON storage.objects
--   FOR INSERT TO anon
--   WITH CHECK (bucket_id = 'insurevis-documents' AND name LIKE 'assessments/%');

-- Check current policies (run this to see what policies exist)
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
