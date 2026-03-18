"use client";
import { useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { useRouter } from "next/navigation";

const RowSchema = z.object({
  full_name: z.string().min(1),
  class_name: z.string().optional(),
  amount_due: z.coerce.number().min(0),
});

type ValidRow = z.infer<typeof RowSchema>;

export function CsvImportForm() {
  const router = useRouter();
  const [preview, setPreview] = useState<ValidRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrors([]);
    setPreview(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const errs: string[] = [];
        const valid: ValidRow[] = [];
        result.data.forEach((row, i) => {
          const parsed = RowSchema.safeParse(row);
          if (!parsed.success) {
            errs.push(`Row ${i + 2}: ${parsed.error.issues[0]?.message}`);
          } else {
            valid.push(parsed.data);
          }
        });
        setErrors(errs);
        setPreview(valid);
      },
    });
  }

  async function handleImport() {
    if (!preview?.length) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/dashboard/students/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: preview }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(null);
        setErrors([]);
        router.refresh();
        alert(`Successfully imported ${data.imported} students.`);
      } else {
        alert(data.error ?? "Import failed");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setStatus("done");
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold mb-1">Import from CSV</h2>
      <p className="text-sm text-gray-500 mb-4">
        Required columns:{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">full_name</code>,{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">amount_due</code>.
        Optional:{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">class_name</code>.
        Student IDs are auto-generated.
      </p>

      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="text-sm mb-3"
      />

      {errors.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 rounded text-sm text-red-700">
          <p className="font-medium mb-1">{errors.length} validation error(s):</p>
          {errors.slice(0, 5).map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          {errors.length > 5 && <p>…and {errors.length - 5} more</p>}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-gray-600 mb-2">
            {preview.length} valid row(s) ready to import.
          </p>
          <button
            onClick={handleImport}
            disabled={status === "loading"}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {status === "loading" ? "Importing…" : "Confirm Import"}
          </button>
        </div>
      )}
    </div>
  );
}
