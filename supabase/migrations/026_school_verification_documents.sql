-- Private supporting documents for the internal school-verification workflow.

CREATE TABLE IF NOT EXISTS school_verification_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'registration_certificate',
      'tax_certificate',
      'authorization',
      'representative_id',
      'other'
    )
  ),
  file_name     TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_path  TEXT NOT NULL UNIQUE,
  mime_type     TEXT NOT NULL CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  size_bytes    BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_verification_documents_school_created
  ON school_verification_documents(school_id, created_at DESC);

ALTER TABLE school_verification_documents ENABLE ROW LEVEL SECURITY;

-- The application performs document operations on the server with the service
-- role after deriving the school from the authenticated tenant context. Keeping
-- the Data API closed prevents document metadata from becoming enumerable.
REVOKE ALL ON TABLE school_verification_documents FROM anon, authenticated;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'school-verification-documents',
  'school-verification-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- There are intentionally no anon/authenticated storage policies. Files are
-- uploaded through the authenticated application route and opened by a short-
-- lived signed URL generated only after tenant or platform-admin authorization.
