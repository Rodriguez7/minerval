"use client";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { renderTemplate } from "@/lib/i18n/template";

const RowSchema = z.object({
  full_name: z.string().min(1),
  class_name: z.string().optional(),
  amount_due: z.coerce.number().min(0),
});

type ValidRow = z.infer<typeof RowSchema>;

const TEMPLATE_CSV = "full_name,class_name,amount_due\nJean Kabila,6ème A,15000\nMarie Mutombo,,12000\n";

function downloadTemplate(fileName: string) {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImportForm() {
  const locale = useLocale();
  const copy = getOnboardingCopy(locale);
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
            errs.push(`${copy.csvImport.linePrefix} ${i + 2}: ${parsed.error.issues[0]?.message}`);
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
        alert(
          renderTemplate(copy.csvImport.successAlert, { count: data.imported })
        );
      } else {
        alert(data.error ?? copy.csvImport.importFailed);
      }
    } catch {
      alert(copy.csvImport.networkError);
    } finally {
      setStatus("done");
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-semibold">{copy.csvImport.title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {copy.csvImport.description}
          </p>
        </div>
        <button
          onClick={() => downloadTemplate(copy.csvImport.templateFileName)}
          className="text-sm text-blue-600 hover:underline whitespace-nowrap ml-4 mt-0.5"
        >
          {copy.csvImport.downloadTemplate}
        </button>
      </div>

      {/* Step guide */}
      <ol className="flex gap-6 mb-5 text-sm text-gray-500">
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">1</span>
          {copy.csvImport.steps[0]}
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">2</span>
          {copy.csvImport.steps[1]}
        </li>
        <li className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">3</span>
          {copy.csvImport.steps[2]}
        </li>
      </ol>

      {/* Drop zone */}
      <label
        htmlFor="csv-upload"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`block border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : fileName
            ? "border-green-300 bg-green-50"
            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          {fileName ? (
            <>
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-green-700">{fileName}</p>
              <p className="text-xs text-gray-400">{copy.csvImport.selectedFileHint}</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-gray-700">{copy.csvImport.uploadPrompt}</p>
              <p className="text-xs text-gray-400">{copy.csvImport.uploadSubprompt}</p>
            </>
          )}
        </div>
      </label>

      <input
        id="csv-upload"
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
      />

      {errors.length > 0 && (
        <div className="mt-3 p-4 bg-red-50 rounded-lg text-sm text-red-700 border border-red-100">
          <p className="font-semibold mb-2">
            {renderTemplate(copy.csvImport.errorSummary, { count: errors.length })}
          </p>
          {errors.slice(0, 5).map((e, i) => (
            <p key={i} className="text-xs">{e}</p>
          ))}
          {errors.length > 5 && (
            <p className="text-xs mt-1">
              {renderTemplate(copy.csvImport.moreErrors, { count: errors.length - 5 })}
            </p>
          )}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 flex items-center justify-between">
          <p className="text-sm text-green-800">
            <span className="font-semibold">
              {renderTemplate(copy.csvImport.readyToImport, { count: preview.length })}
            </span>
          </p>
          <button
            onClick={handleImport}
            disabled={status === "loading"}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {status === "loading" ? copy.csvImport.importPending : copy.csvImport.importNow}
          </button>
        </div>
      )}
    </div>
  );
}
