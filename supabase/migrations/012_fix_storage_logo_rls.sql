-- Fix: scope storage logo policies to the uploading user's own school.
-- Migration 011 applied overly permissive INSERT/UPDATE policies.
-- This migration replaces them with membership-scoped versions.

DROP POLICY IF EXISTS "school logos publicly readable" ON storage.objects;
CREATE POLICY "school logos publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-logos');

DROP POLICY IF EXISTS "authenticated users can upload logos" ON storage.objects;
CREATE POLICY "authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1
      FROM school_memberships sm
      WHERE sm.school_id = (storage.foldername(name))[1]::uuid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
        AND sm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "authenticated users can update logos" ON storage.objects;
CREATE POLICY "authenticated users can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1
      FROM school_memberships sm
      WHERE sm.school_id = (storage.foldername(name))[1]::uuid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
        AND sm.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'school-logos'
    AND EXISTS (
      SELECT 1
      FROM school_memberships sm
      WHERE sm.school_id = (storage.foldername(name))[1]::uuid
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
        AND sm.status = 'active'
    )
  );
