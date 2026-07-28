import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const BUCKET = "school-verification-documents";
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
const ALLOWED_DOCUMENT_TYPES = [
  "registration_certificate",
  "tax_certificate",
  "authorization",
  "representative_id",
  "other",
] as const;
const MAX_SIZE = 10 * 1024 * 1024;

function extensionFor(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

export async function POST(req: NextRequest) {
  const { user, school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const file = formData.get("document");
  const documentType = formData.get("documentType")?.toString();
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Sélectionnez un document." }, { status: 400 });
  }
  if (
    !documentType ||
    !ALLOWED_DOCUMENT_TYPES.includes(
      documentType as (typeof ALLOWED_DOCUMENT_TYPES)[number]
    )
  ) {
    return NextResponse.json({ error: "Type de document invalide." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Le document doit être un PDF, un JPEG ou un PNG." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Le document doit faire 10 Mo maximum." },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const id = crypto.randomUUID();
  const path = `${school.id}/${id}.${extensionFor(file.type)}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Impossible d’envoyer le document." },
      { status: 500 }
    );
  }

  const { data, error: insertError } = await admin
    .from("school_verification_documents")
    .insert({
      id,
      school_id: school.id,
      document_type: documentType,
      file_name: file.name.slice(0, 255),
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select("id,document_type,file_name,mime_type,size_bytes,created_at")
    .single();

  if (insertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json(
      { error: "Impossible d’enregistrer le document." },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Document manquant." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: document, error: lookupError } = await admin
    .from("school_verification_documents")
    .select("id,storage_path")
    .eq("id", id)
    .eq("school_id", school.id)
    .maybeSingle();

  if (lookupError || !document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const { error: deleteError } = await admin
    .from("school_verification_documents")
    .delete()
    .eq("id", document.id)
    .eq("school_id", school.id);
  if (deleteError) {
    return NextResponse.json(
      { error: "Impossible de supprimer le document." },
      { status: 500 }
    );
  }

  await admin.storage.from(BUCKET).remove([document.storage_path]);
  return NextResponse.json({ success: true });
}
