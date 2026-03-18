import { getAdminClient } from "@/lib/supabase";
import { takeJoined, type MaybeJoined } from "@/lib/supabase-joins";
import Link from "next/link";
import type { PaymentRequest, School, Student, Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReceiptPayment = Pick<
  PaymentRequest,
  "id" | "amount" | "phone" | "telecom" | "status" | "created_at" | "settled_at"
> & {
  students: MaybeJoined<Pick<Student, "full_name" | "external_id">>;
  schools: MaybeJoined<Pick<School, "name" | "payment_access_token" | "currency">>;
};

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
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
      "id, amount, phone, telecom, status, created_at, settled_at, students(full_name, external_id), schools(name, payment_access_token, currency)"
    )
    .eq("id", ref)
    .single();

  const typedPayment = payment as ReceiptPayment | null;
  const student = typedPayment ? takeJoined(typedPayment.students) : null;
  const school = typedPayment ? takeJoined(typedPayment.schools) : null;

  if (!typedPayment) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Payment not found.</p>
      </main>
    );
  }

  const maskedPhone = `••••••${typedPayment.phone.slice(-4)}`;

  const statusConfig = {
    pending: { label: "Processing", bg: "bg-yellow-100 text-yellow-700" },
    success: { label: "Confirmed", bg: "bg-green-100 text-green-700" },
    failed: { label: "Failed", bg: "bg-red-100 text-red-700" },
  } as const;

  const { label, bg } =
    statusConfig[typedPayment.status as keyof typeof statusConfig] ?? {
      label: typedPayment.status,
      bg: "bg-gray-100 text-gray-700",
    };

  const rows: [string, string][] = [
    ["School", school?.name ?? "—"],
    ["Student", student?.full_name ?? "—"],
    ["Student ID", student?.external_id ?? "—"],
    ["Amount", `${Number(typedPayment.amount).toLocaleString()} ${school?.currency ?? "FC"}`],
    ["Phone", maskedPhone],
    [
      "Provider",
      TELECOM_LABELS[typedPayment.telecom as Telecom] ?? typedPayment.telecom,
    ],
    ["Reference", typedPayment.id],
    ["Date", new Date(typedPayment.created_at).toLocaleString()],
    ...(typedPayment.settled_at
      ? [["Settled", new Date(typedPayment.settled_at).toLocaleString()] as [string, string]]
      : []),
  ];

  const retryHref =
    school?.payment_access_token && student?.external_id
      ? `/pay/access/${school.payment_access_token}?student=${encodeURIComponent(student.external_id)}`
      : "/pay";

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold">Payment Receipt</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${bg}`}>
            {label}
          </span>
        </div>

        {typedPayment.status === "pending" && (
          <p className="text-sm text-gray-600 mb-6 p-3 bg-blue-50 rounded-lg">
            Your payment is being processed. You will receive a confirmation prompt on
            your phone shortly.
          </p>
        )}

        {typedPayment.status === "failed" && (
          <div className="mb-6 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">
              This payment was not completed.{" "}
              <Link href={retryHref} className="underline font-medium">
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
