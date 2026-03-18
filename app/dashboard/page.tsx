export const dynamic = "force-dynamic";

import { getAuthenticatedSchool } from "@/lib/auth";
import { getSchoolPaymentUrl } from "@/lib/payment-access";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined, type MaybeJoined } from "@/lib/supabase-joins";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { markPaymentFailed, regeneratePaymentAccessToken } from "./actions";
import type { PaymentRequest, Student, Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";

type DashboardPayment = Pick<
  PaymentRequest,
  "id" | "amount" | "phone" | "telecom" | "status" | "created_at" | "settled_at"
> & {
  students: MaybeJoined<Pick<Student, "full_name" | "external_id">>;
};

type StudentDueRow = Pick<
  Student,
  "id" | "external_id" | "full_name" | "class_name" | "amount_due"
>;

async function loadDashboardData() {
  const school = await getAuthenticatedSchool();
  const admin = getAdminClient();

  const [studentCountResult, paymentsResult, studentsWithDuesResult] = await Promise.all([
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id),
    admin
      .from("payment_requests")
      .select(
        "id, amount, phone, telecom, status, created_at, settled_at, students(full_name, external_id)"
      )
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("students")
      .select("id, external_id, full_name, class_name, amount_due")
      .eq("school_id", school.id)
      .gt("amount_due", 0)
      .order("amount_due", { ascending: false })
      .limit(20),
  ]);

  const allPayments = (paymentsResult.data ?? []) as DashboardPayment[];
  const pending = allPayments.filter((p) => p.status === "pending");
  const successful = allPayments.filter((p) => p.status === "success");
  const studentsWithDues = (studentsWithDuesResult.data ?? []) as StudentDueRow[];
  const paymentUrl = getSchoolPaymentUrl(school.payment_access_token);
  const paymentQrCode = await QRCode.toDataURL(paymentUrl, { margin: 1, width: 256 });

  const stats = [
    { label: "Students", value: studentCountResult.count ?? 0 },
    {
      label: "Pending",
      value: pending.length,
      sub: `${pending.reduce((s, p) => s + p.amount, 0).toLocaleString()} ${school.currency}`,
    },
    {
      label: "Confirmed",
      value: successful.length,
      sub: `${successful.reduce((s, p) => s + p.amount, 0).toLocaleString()} ${school.currency}`,
    },
    { label: "With Dues", value: studentsWithDues.length },
  ];

  const staleCutoff = new Date(Date.now() - 3_600_000).toISOString();

  return {
    school,
    allPayments,
    stats,
    staleCutoff,
    studentsWithDues,
    paymentUrl,
    paymentQrCode,
  };
}

export default async function DashboardPage() {
  const {
    school,
    allPayments,
    stats,
    staleCutoff,
    studentsWithDues,
    paymentUrl,
    paymentQrCode,
  } = await loadDashboardData();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Overview</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
            {s.sub && <p className="text-sm text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">School Payment QR</h2>
            <p className="text-sm text-gray-500">
              Share this QR code or link with parents. They scan it, then enter the
              student ID.
            </p>
          </div>
          <form action={regeneratePaymentAccessToken}>
            <button
              type="submit"
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Regenerate QR
            </button>
          </form>
        </div>
        <div className="p-5 flex flex-col gap-6 md:flex-row md:items-center">
          <Image
            src={paymentQrCode}
            alt={`Payment QR for ${school.name}`}
            width={208}
            height={208}
            unoptimized
            className="rounded-lg border p-2 bg-white"
          />
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Active payment link</p>
            <Link
              href={paymentUrl}
              target="_blank"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {paymentUrl}
            </Link>
            <p className="text-xs text-gray-500">
              Regenerating the QR code immediately disables the previous school payment
              link.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold">Recent Payments</h2>
          <Link
            href={paymentUrl}
            target="_blank"
            className="text-sm text-blue-600 hover:underline"
          >
            Payment page ↗
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                {["Student", "Amount", "Phone", "Provider", "Status", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-gray-500 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {allPayments.map((p) => {
                const student = takeJoined(p.students);
                const stale = p.status === "pending" && p.created_at < staleCutoff;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {student?.full_name}
                      <span className="text-gray-400 text-xs ml-1">
                        ({student?.external_id})
                      </span>
                    </td>
                    <td className="px-4 py-3">{Number(p.amount).toLocaleString()} {school.currency}</td>
                    <td className="px-4 py-3">{p.phone}</td>
                    <td className="px-4 py-3">
                      {TELECOM_LABELS[p.telecom as Telecom] ?? p.telecom}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.status === "success"
                            ? "bg-green-100 text-green-700"
                            : p.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {stale && (
                        <form
                          action={async () => {
                            "use server";
                            await markPaymentFailed(p.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:underline"
                          >
                            Mark failed
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {allPayments.length === 0 && (
            <p className="p-5 text-gray-400">No payments yet.</p>
          )}
        </div>
      </div>

      {/* Students with outstanding dues */}
      {studentsWithDues.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Students with Outstanding Fees</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "ID", "Class", "Amount Due"].map((h) => (
                  <th key={h} className="px-4 py-3 text-gray-500 font-medium text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {studentsWithDues.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{s.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.external_id}</td>
                  <td className="px-4 py-3 text-gray-500">{s.class_name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">
                    {Number(s.amount_due).toLocaleString()} {school.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
