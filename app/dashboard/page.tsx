export const dynamic = "force-dynamic";

import { getSchoolPaymentUrl } from "@/lib/payment-access";
import { createSSRClient } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
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
  const { school } = await getTenantContext();
  const supabase = await createSSRClient();

  const [studentCountResult, paymentsResult, studentsWithDuesResult] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id),
    supabase
      .from("payment_requests")
      .select(
        "id, amount, phone, telecom, status, created_at, settled_at, students(full_name, external_id)"
      )
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
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
    { label: "Eleves", value: studentCountResult.count ?? 0 },
    {
      label: "En attente",
      value: pending.length,
      sub: `${pending.reduce((s, p) => s + p.amount, 0).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      label: "Confirmes",
      value: successful.length,
      sub: `${successful.reduce((s, p) => s + p.amount, 0).toLocaleString("fr-FR")} ${school.currency}`,
    },
    { label: "Avec soldes", value: studentsWithDues.length },
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

function StatusBadge({ status }: { status: string }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    failed: "bg-red-50 text-red-700 border border-red-200",
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
  } as const;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status as keyof typeof styles] ?? "bg-zinc-100 text-zinc-600 border border-zinc-200"
      }`}
    >
      {status === "success"
        ? "succes"
        : status === "failed"
          ? "echec"
          : status === "pending"
            ? "en attente"
            : status}
    </span>
  );
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Vue d&apos;ensemble</h1>
        <p className="text-sm text-zinc-500 mt-1">Activite des paiements et indicateurs de l&apos;ecole</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-bold font-mono text-zinc-950 mt-2">{s.value}</p>
            {s.sub && <p className="text-xs text-zinc-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">QR de paiement de l&apos;ecole</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Partagez ce QR code ou ce lien avec les parents pour collecter les frais
            </p>
          </div>
          <form action={regeneratePaymentAccessToken}>
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Regenerer
            </button>
          </form>
        </div>
        <div className="px-4 py-5 md:px-6 flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <Image
            src={paymentQrCode}
            alt={`QR de paiement pour ${school.name}`}
            width={176}
            height={176}
            unoptimized
            className="rounded-lg border border-zinc-200 p-2 bg-white shrink-0"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Lien de paiement actif</p>
            <Link
              href={paymentUrl}
              target="_blank"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all transition-colors"
            >
              {paymentUrl}
            </Link>
            <p className="text-xs text-zinc-400">
              La regeneration invalide immediatement l&apos;ancien lien.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Paiements recents</h2>
          <Link
            href={paymentUrl}
            target="_blank"
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            Page de paiement ↗
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Eleve", "Montant", "Telephone", "Operateur", "Statut", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {allPayments.map((p) => {
                const student = takeJoined(p.students);
                const stale = p.status === "pending" && p.created_at < staleCutoff;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-900">
                      {student?.full_name}
                      <span className="text-zinc-400 text-xs ml-1.5">
                        {student?.external_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                      {Number(p.amount).toLocaleString("fr-FR")} {school.currency}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {TELECOM_LABELS[p.telecom as Telecom] ?? p.telecom}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {new Date(p.created_at).toLocaleDateString("fr-FR")}
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
                            className="text-xs text-red-600 hover:underline transition-colors"
                          >
                            Marquer en echec
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
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">Aucun paiement pour le moment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Students with outstanding dues */}
      {studentsWithDues.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Frais impayes</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Eleves avec un solde restant</p>
          </div>
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Nom", "ID", "Classe", "Montant du"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {studentsWithDues.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">{s.external_id}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{s.class_name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold font-mono text-zinc-900">
                    {Number(s.amount_due).toLocaleString("fr-FR")} {school.currency}
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
