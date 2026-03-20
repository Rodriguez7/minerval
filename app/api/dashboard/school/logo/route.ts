import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  const { school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const admin = getAdminClient();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be PNG, JPEG, WebP, or GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 }
    );
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${school.id}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("school-logos")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from("school-logos")
    .getPublicUrl(path);

  // Cache-bust param stored in DB — intentional, each new upload overwrites.
  const logo_url = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await admin
    .from("schools")
    .update({ logo_url })
    .eq("id", school.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save logo URL" }, { status: 500 });
  }

  return NextResponse.json({ logo_url });
}
