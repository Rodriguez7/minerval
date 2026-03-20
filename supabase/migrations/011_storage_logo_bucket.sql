-- Create public school-logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read logos (they are served by public CDN URL anyway)
CREATE POLICY "school logos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-logos');

-- Allow authenticated users to upload/replace logos
CREATE POLICY "authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'school-logos');

CREATE POLICY "authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'school-logos');

-- No DELETE policy is intentional: logos are replaced via upsert, never deleted through the app.
-- Removal (if ever needed) is done through the Supabase dashboard by an admin.
