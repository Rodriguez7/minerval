"use client";
import { useRef, useState } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ValidRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [dragging, setDragging] = useState(false);

  function parseFile(file: File) {
    setFileName(file.name);
    setErrors([]);
    setPreview(null);
    setStatus("idle");
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

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
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
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
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

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {fileName ? (
            <p className="text-sm font-medium text-blue-600">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-400">CSV file (.csv)</p>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
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
        <div className="mt-4 flex items-center gap-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{preview.length}</span> valid row(s) ready to import
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
