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
import { collectAllPages } from "@/lib/paged-query";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSchoolReadinessItems } from "@/lib/school-readiness";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { AppLocale } from "@/lib/i18n/config";

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

async function loadDashboardData(locale: AppLocale) {
  const { school } = await getTenantContext();
  const supabase = await createSSRClient();
  const fr = locale === "fr";

  const [
    studentCountResult,
    paymentsResult,
    studentsWithDuesResult,
    studentsWithDuesCountResult,
    paymentMetrics,
    guardianCountResult,
    balanceCountResult,
    whatsappSettingsResult,
  ] = await Promise.all([
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
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .gt("amount_due", 0),
    collectAllPages<{ amount: number; status: string }>((from, to) =>
      supabase
        .from("payment_requests")
        .select("amount, status")
        .eq("school_id", school.id)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    supabase
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .not("whatsapp_opt_in_at", "is", null)
      .is("whatsapp_opted_out_at", null),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .gt("amount_due", 0)
      .not("balance_due_at", "is", null),
    supabase
      .from("school_whatsapp_settings")
      .select("automatic_reminders_enabled")
      .eq("school_id", school.id)
      .maybeSingle(),
  ]);

  const allPayments = (paymentsResult.data ?? []) as DashboardPayment[];
  const pending = paymentMetrics.filter((p) => p.status === "pending");
  const successful = paymentMetrics.filter((p) => p.status === "success");
  const studentsWithDues = (studentsWithDuesResult.data ?? []) as StudentDueRow[];
  const paymentUrl = getSchoolPaymentUrl(school.payment_access_token);
  const paymentQrCode = await QRCode.toDataURL(paymentUrl, { margin: 1, width: 256 });

  const stats = [
    { label: fr ? "Élèves" : "Students", value: studentCountResult.count ?? 0 },
    {
      label: fr ? "En attente" : "Pending",
      value: pending.length,
      sub: `${pending.reduce((s, p) => s + p.amount, 0).toLocaleString("fr-FR")} ${school.currency}`,
    },
    {
      label: fr ? "Confirmés" : "Confirmed",
      value: successful.length,
      sub: `${successful.reduce((s, p) => s + p.amount, 0).toLocaleString("fr-FR")} ${school.currency}`,
    },
    { label: fr ? "Avec soldes" : "With balances", value: studentsWithDuesCountResult.count ?? 0 },
  ];
  const readinessItems = getSchoolReadinessItems(
    school,
    {
      students: studentCountResult.count ?? 0,
      guardians: guardianCountResult.count ?? 0,
      balancesWithDueDate: balanceCountResult.count ?? 0,
    },
    {
      automaticRemindersEnabled:
        whatsappSettingsResult.data?.automatic_reminders_enabled ?? true,
    },
    locale
  );

  const staleCutoff = new Date(Date.now() - 3_600_000).toISOString();

  return {
    school,
    allPayments,
    stats,
    staleCutoff,
    studentsWithDues,
    paymentUrl,
    paymentQrCode,
    readinessItems,
  };
}

function StatusBadge({ status, locale }: { status: string; locale: AppLocale }) {
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
        ? locale === "fr" ? "succès" : "success"
        : status === "failed"
          ? locale === "fr" ? "échec" : "failed"
          : status === "pending"
            ? locale === "fr" ? "en attente" : "pending"
            : status}
    </span>
  );
}

export default async function DashboardPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const {
    school,
    allPayments,
    stats,
    staleCutoff,
    studentsWithDues,
    paymentUrl,
    paymentQrCode,
    readinessItems,
  } = await loadDashboardData(locale);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Vue d’ensemble" : "Overview"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Activité des paiements et indicateurs de l’établissement" : "Payment activity and school metrics"}
        </p>
      </div>

      <OnboardingChecklist locale={locale} items={readinessItems} />

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
            <h2 className="text-sm font-semibold text-zinc-900">
              {fr ? "QR de paiement de l’établissement" : "School payment QR"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {fr
                ? "Partagez ce QR code ou ce lien avec les parents pour collecter les frais."
                : "Share this QR code or link with parents to collect fees."}
            </p>
          </div>
          <form action={regeneratePaymentAccessToken}>
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              {fr ? "Régénérer" : "Regenerate"}
            </button>
          </form>
        </div>
        <div className="px-4 py-5 md:px-6 flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <Image
            src={paymentQrCode}
            alt={fr ? `QR de paiement pour ${school.name}` : `Payment QR for ${school.name}`}
            width={176}
            height={176}
            unoptimized
            className="rounded-lg border border-zinc-200 p-2 bg-white shrink-0"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Lien de paiement actif" : "Active payment link"}
            </p>
            <Link
              href={paymentUrl}
              target="_blank"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all transition-colors"
            >
              {paymentUrl}
            </Link>
            <p className="text-xs text-zinc-400">
              {fr
                ? "La régénération invalide immédiatement l’ancien lien."
                : "Regenerating immediately invalidates the previous link."}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Paiements récents" : "Recent payments"}
          </h2>
          <Link
            href={paymentUrl}
            target="_blank"
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {fr ? "Page de paiement ↗" : "Payment page ↗"}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["Élève", "Montant", "Téléphone", "Opérateur", "Statut", "Date", ""]
                  : ["Student", "Amount", "Phone", "Operator", "Status", "Date", ""]
                ).map((h) => (
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
                      <StatusBadge status={p.status} locale={locale} />
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
                            {fr ? "Marquer en échec" : "Mark failed"}
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
              <p className="text-sm text-zinc-400">
                {fr ? "Aucun paiement pour le moment." : "No payments yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Students with outstanding dues */}
      {studentsWithDues.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">
              {fr ? "Frais impayés" : "Outstanding fees"}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {fr ? "Élèves avec un solde restant" : "Students with a remaining balance"}
            </p>
          </div>
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["Nom", "ID", "Classe", "Montant dû"]
                  : ["Name", "ID", "Class", "Amount due"]
                ).map((h) => (
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
