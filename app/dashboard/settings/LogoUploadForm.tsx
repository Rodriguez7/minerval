"use client";

import { useState } from "react";

interface Props {
  currentLogoUrl: string | null;
}

export function LogoUploadForm({ currentLogoUrl }: Props) {
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
        setError(json.error ?? "Upload failed");
      } else {
        setLogoUrl(json.logo_url);
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-uploaded if needed
      e.target.value = "";
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold text-lg mb-4">School Logo</h2>

      {logoUrl && (
        <img
          src={logoUrl}
          alt="School logo"
          className="h-16 w-auto mb-4 rounded object-contain"
        />
      )}

      <label
        className={`inline-block cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium ${
          uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-700"
        }`}
      >
        {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
      </label>

      <p className="text-gray-400 text-xs mt-2">PNG, JPEG, WebP or GIF — max 2 MB</p>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
