import { getAdminClient } from "@/lib/supabase";
import Link from "next/link";
import type { Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolCode: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { schoolCode } = await params;
  const { ref } = await searchParams;

  if (!ref) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No payment reference provided.</p>
      </main>
    );
  }

  const { data: payment } = await getAdminClient()
    .from("payment_requests")
    .select(
      "id, amount, phone, telecom, status, created_at, settled_at, students(full_name, external_id), schools(name, code)"
    )
    .eq("id", ref)
    .single();

  if (!payment || (payment.schools as any)?.code !== schoolCode) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Payment not found.</p>
      </main>
    );
  }

  const student = payment.students as any;
  const school = payment.schools as any;
  const maskedPhone = `••••••${payment.phone.slice(-4)}`;

  const statusConfig = {
    pending: { label: "Processing", bg: "bg-yellow-100 text-yellow-700" },
    success: { label: "Confirmed", bg: "bg-green-100 text-green-700" },
    failed: { label: "Failed", bg: "bg-red-100 text-red-700" },
  } as const;

  const { label, bg } =
    statusConfig[payment.status as keyof typeof statusConfig] ??
    { label: payment.status, bg: "bg-gray-100 text-gray-700" };

  const rows: [string, string][] = [
    ["School", school?.name ?? "—"],
    ["Student", student?.full_name ?? "—"],
    ["Student ID", student?.external_id ?? "—"],
    ["Amount", `${Number(payment.amount).toLocaleString()} FC`],
    ["Phone", maskedPhone],
    ["Provider", TELECOM_LABELS[payment.telecom as Telecom] ?? payment.telecom],
    ["Reference", payment.id],
    ["Date", new Date(payment.created_at).toLocaleString()],
    ...(payment.settled_at
      ? [["Settled", new Date(payment.settled_at).toLocaleString()] as [string, string]]
      : []),
  ];

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Payment Receipt</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${bg}`}>{label}</span>
        </div>

        {payment.status === "pending" && (
          <p className="text-sm text-gray-600 mb-6 p-3 bg-blue-50 rounded-lg">
            Your payment is being processed. You will receive a confirmation prompt on your phone shortly.
          </p>
        )}

        {payment.status === "failed" && (
          <div className="mb-6 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">
              This payment was not completed.{" "}
              <Link
                href={`/pay/${schoolCode}?student=${student?.external_id}`}
                className="underline font-medium"
              >
                Try again
              </Link>
            </p>
          </div>
        )}

        <dl className="space-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-gray-500 shrink-0">{k}</dt>
              <dd className="font-medium text-right truncate max-w-xs">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
