export const dynamic = "force-dynamic";

import { getAuthenticatedSchool } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { createFee, toggleFeeActive } from "../actions";

export default async function FeesPage() {
  const school = await getAuthenticatedSchool();

  const { data: fees } = await getAdminClient()
    .from("fees")
    .select("id, title, type, amount, active, created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Fees</h1>

      {/* Create fee form */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Create Fee</h2>
        <form
          action={createFee.bind(null, null) as (formData: FormData) => void}
          className="flex flex-wrap gap-3"
        >
          <input
            name="title"
            placeholder="Fee title *"
            required
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-36"
          />
          <select
            name="type"
            required
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="recurring">Recurring</option>
            <option value="special">Special</option>
          </select>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount (FC) *"
            required
            className="border rounded-lg px-3 py-2 text-sm w-36"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create
          </button>
        </form>
      </div>

      {/* Fee list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Title", "Type", "Amount", "Status", ""].map((h) => (
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
            {fees?.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{f.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      f.type === "recurring"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {f.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {Number(f.amount).toLocaleString()} FC
                </td>
                <td className="px-4 py-3">
                  <span className={f.active ? "text-green-600" : "text-gray-400"}>
                    {f.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form
                    action={
                      toggleFeeActive.bind(
                        null,
                        f.id,
                        !f.active
                      ) as () => void
                    }
                  >
                    <button
                      type="submit"
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {f.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!fees?.length && (
          <p className="p-5 text-gray-400">No fees defined yet.</p>
        )}
      </div>
    </div>
  );
}
