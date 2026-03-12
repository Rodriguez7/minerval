export const dynamic = "force-dynamic";

import { getAuthenticatedSchool } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { addStudent } from "../actions";
import { CsvImportForm } from "./CsvImportForm";

export default async function StudentsPage() {
  const school = await getAuthenticatedSchool();

  const { data: students } = await getAdminClient()
    .from("students")
    .select("id, external_id, full_name, class_name, amount_due, created_at")
    .eq("school_id", school.id)
    .order("full_name")
    .limit(200);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Students</h1>

      {/* Add student */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Add Student</h2>
        <form
          action={addStudent.bind(null, null) as (formData: FormData) => void}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <input
            name="external_id"
            placeholder="Student ID *"
            required
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            name="full_name"
            placeholder="Full Name *"
            required
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            name="class_name"
            placeholder="Class (optional)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            name="amount_due"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount Due *"
            required
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <div className="md:col-span-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>

      {/* CSV import */}
      <CsvImportForm />

      {/* Student list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">
            All Students ({students?.length ?? 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "ID", "Class", "Amount Due", "Added"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-gray-500 font-medium text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {students?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.external_id}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.class_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.amount_due > 0 ? "font-semibold" : "text-gray-400"
                      }
                    >
                      {Number(s.amount_due).toLocaleString()} FC
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students?.length && (
            <p className="p-5 text-gray-400">No students yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
