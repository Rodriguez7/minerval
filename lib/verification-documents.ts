import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "school-verification-documents";

export type VerificationDocument = {
  id: string;
  school_id?: string;
  document_type: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
};

export async function getVerificationDocuments(
  admin: SupabaseClient,
  schoolId: string
): Promise<VerificationDocument[]> {
  const { data: rows } = await admin
    .from("school_verification_documents")
    .select("id,school_id,document_type,file_name,storage_path,mime_type,size_bytes,created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  return signVerificationDocuments(admin, rows ?? []);
}

export async function signVerificationDocuments(
  admin: SupabaseClient,
  rows: Array<{
    id: string;
    school_id: string;
    document_type: string;
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>
): Promise<VerificationDocument[]> {
  return Promise.all(
    rows.map(async ({ storage_path, ...document }) => {
      const { data } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(storage_path, 300);
      return { ...document, url: data?.signedUrl ?? null };
    })
  );
}
