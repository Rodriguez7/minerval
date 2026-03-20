"use client";
import { useState, useRef } from "react";

interface Props {
  canBulkOps: boolean;
}

export function BulkFeeForm({ canBulkOps }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const text = await file.text();
    const lines = text.trim().split("\n");

    // Skip header row if it starts with "external_id"
    const dataLines = lines[0]?.toLowerCase().startsWith("external_id")
      ? lines.slice(1)
      : lines;

    const rows = dataLines
      .map((line) => {
        const [external_id, amount_due_str] = line.split(",");
        const amount_due = parseFloat(amount_due_str?.trim() ?? "");
        return external_id?.trim() && !isNaN(amount_due)
          ? { external_id: external_id.trim(), amount_due }
          : null;
      })
      .filter(Boolean);

    if (rows.length === 0) {
      setStatus("No valid rows found. Check your CSV format.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/dashboard/students/bulk-fee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Update failed.");
      } else {
        setStatus(
          `Updated ${data.updated} student${data.updated !== 1 ? "s" : ""}.${
            data.errors ? ` ${data.errors} row(s) had no matching student.` : ""
          }`
        );
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!canBulkOps) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-1">Bulk Fee Update</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload a CSV with columns{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">
            external_id,amount_due
          </code>{" "}
          to update balances in bulk.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          <p>
            Bulk fee updates are available on the{" "}
            <a href="/dashboard/billing" className="font-medium text-gray-900 underline">
              Pro plan
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold mb-1">Bulk Fee Update</h2>
      <p className="text-sm text-gray-500 mb-4">
        Upload a CSV with columns{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">
          external_id,amount_due
        </code>{" "}
        to update balances in bulk.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        {status && (
          <p
            className={`text-sm ${
              status.startsWith("Updated")
                ? "text-green-700"
                : "text-red-600"
            }`}
          >
            {status}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Updating…" : "Upload & Update"}
        </button>
      </form>
    </div>
  );
}
