"use client";
import { useActionState } from "react";
import { createSchool } from "@/app/actions/onboarding";
import { useState } from "react";

export function SchoolForm() {
  const [state, action, isPending] = useActionState(createSchool, null);
  const [schoolCode, setSchoolCode] = useState("");
  const [studentIdPrefix, setStudentIdPrefix] = useState("");

  function handleNameChange(v: string) {
    const derived = v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    setSchoolCode(derived);
    const words = v.trim().split(/\s+/);
    const prefix = words
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 6);
    if (prefix.length >= 2) setStudentIdPrefix(prefix);
  }

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <div>
        <p className="text-sm text-blue-600 font-medium">Step 1 of 3</p>
        <h1 className="text-2xl font-bold mt-1">Set up your school</h1>
        <p className="text-sm text-gray-500 mt-1">
          This information appears on receipts and reports.
        </p>
      </div>
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">School name</label>
          <input
            name="schoolName"
            type="text"
            required
            minLength={2}
            maxLength={200}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School code</label>
          <input
            name="schoolCode"
            type="text"
            required
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            pattern="[a-z0-9-]+"
            minLength={2}
            maxLength={30}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Lowercase letters, numbers, hyphens. Used in your payment link URL.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Student ID prefix</label>
          <input
            name="studentIdPrefix"
            type="text"
            required
            value={studentIdPrefix}
            onChange={(e) => setStudentIdPrefix(e.target.value.toUpperCase().slice(0, 6))}
            pattern="[A-Z0-9]{2,6}"
            minLength={2}
            maxLength={6}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            2–6 uppercase letters/numbers. Student IDs will look like ESM-0001.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            name="currency"
            defaultValue="FC"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="FC">FC — Franc Congolais</option>
            <option value="USD">USD — US Dollar</option>
          </select>
        </div>
        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
