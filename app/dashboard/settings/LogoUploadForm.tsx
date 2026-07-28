"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/client";

interface Props {
  currentLogoUrl: string | null;
  canManage: boolean;
}

export function LogoUploadForm({ currentLogoUrl, canManage }: Props) {
  const fr = useLocale() === "fr";
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/dashboard/school/logo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? (fr ? "L’envoi du logo a échoué." : "Logo upload failed."));
      } else {
        setLogoUrl(json.logo_url);
      }
    } catch {
      setError(fr ? "L’envoi du logo a échoué. Réessayez." : "Logo upload failed. Try again.");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-uploaded if needed
      e.target.value = "";
    }
  }

  return (
      <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold text-lg mb-4">{fr ? "Logo de l’établissement" : "School logo"}</h2>

      {logoUrl && (
        <Image
          src={logoUrl}
          alt={fr ? "Logo de l’établissement" : "School logo"}
          width={256}
          height={64}
          className="h-16 w-auto mb-4 rounded object-contain"
        />
      )}

      {canManage && (
        <>
          <label
            className={`inline-block cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium ${
              uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-700"
            }`}
          >
            {uploading
              ? fr ? "Envoi…" : "Uploading…"
              : logoUrl
                ? fr ? "Remplacer le logo" : "Replace logo"
                : fr ? "Importer le logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleChange}
              disabled={uploading}
            />
          </label>

          <p className="text-gray-400 text-xs mt-2">
            {fr ? "PNG, JPEG, WebP ou GIF — 2 Mo max." : "PNG, JPEG, WebP, or GIF — 2 MB max."}
          </p>
        </>
      )}

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
