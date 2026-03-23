import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { ApproveButton } from "./ApproveButton";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

export default async function AdminPayoutsPage() {
  const ssr = await createSSRClient();
  const { data: { user } } = await ssr.auth.getUser();

  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const admin = getAdminClient();

  const { data: payouts } = await admin
    .from("school_payouts")
    .select("id, school_id, amount, phone, telecom, status, created_at, requested_by, schools(name), profiles(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (payouts ?? []).filter((p) => p.status === "pending");
  const history = (payouts ?? []).filter((p) => p.status !== "pending");

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-xl font-bold">Payout Requests</h1>

      <section>
        <h2 className="font-semibold mb-3">Pending Approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2">School</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Requested</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{(p.schools as { name?: string } | null)?.name ?? p.school_id}</td>
                  <td className="py-2">{p.amount.toLocaleString()}</td>
                  <td className="py-2">{p.phone}</td>
                  <td className="py-2">{p.telecom}</td>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <ApproveButton payoutId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2">School</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{(p.schools as { name?: string } | null)?.name ?? p.school_id}</td>
                  <td className="py-2">{p.amount.toLocaleString()}</td>
                  <td className="py-2">{p.phone}</td>
                  <td className="py-2">{STATUS_LABELS[p.status] ?? p.status}</td>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
