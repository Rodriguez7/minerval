export const dynamic = "force-dynamic";

import { getAdminClient } from "@/lib/supabase";
import Image from "next/image";
import { notFound } from "next/navigation";
import { TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { formatDateTime, formatMoney } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);
  const { ref } = await searchParams;

  if (!ref) notFound();

  const admin = getAdminClient();

  const { data: paymentData, error: paymentError } = await admin
    .from("payment_requests")
    .select(
      `id, amount, fee_amount, status, settled_at, telecom, phone,
       serdipay_transaction_id,
       students(full_name, external_id, class_name),
       schools!inner(
         name, currency, logo_url,
         school_subscriptions!inner(
           plans!inner(can_branded_receipts)
         )
       )`
    )
    .eq("id", ref)
    .single();

  // Fallback: retry without logo_url if PostgREST schema cache doesn't have it yet.
  let payment = paymentData;
  if (paymentError) {
    const { data: fallback } = await admin
      .from("payment_requests")
      .select(
        `id, amount, fee_amount, status, settled_at, telecom, phone,
         serdipay_transaction_id,
         students(full_name, external_id, class_name),
         schools!inner(
           name, currency,
           school_subscriptions!inner(
             plans!inner(can_branded_receipts)
           )
         )`
      )
      .eq("id", ref)
      .single();
    payment = fallback as unknown as typeof paymentData;
  }

  if (!payment) notFound();

  type StudentRow = { full_name: string; external_id: string; class_name: string | null } | null;
  type PlanRow = { can_branded_receipts: boolean };
  type SubRow = { plans: PlanRow | PlanRow[] };
  type SchoolRow = { name: string; currency: string; logo_url?: string | null; school_subscriptions: SubRow | SubRow[] };

  const student = payment.students as unknown as StudentRow;
  const school = payment.schools as unknown as SchoolRow;
  const currency = school.currency ?? "FC";

  const subData = Array.isArray(school.school_subscriptions)
    ? school.school_subscriptions[0]
    : school.school_subscriptions;
  const plan = Array.isArray(subData?.plans) ? subData.plans[0] : subData?.plans;
  const canBrandedReceipts = plan?.can_branded_receipts ?? false;

  const isSuccess = payment.status === "success";
  const settledDate = payment.settled_at ? new Date(payment.settled_at) : null;

  return (
    <main className="relative min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        {/* School branding */}
        <div className="mb-8 text-center">
          {canBrandedReceipts ? (
            <>
              {school.logo_url && (
                <Image
                  src={school.logo_url}
                  alt={`${school.name} logo`}
                  width={192}
                  height={48}
                  className="h-12 w-auto mx-auto mb-3 object-contain"
                />
              )}
              <h1 className="text-2xl font-bold">{school.name}</h1>
              <p className="text-gray-500 text-sm mt-1">{copy.receipt.title}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{copy.receipt.title}</h1>
              <p className="text-gray-500 text-sm mt-1">{school.name}</p>
            </>
          )}
        </div>

        {/* Status banner */}
        <div
          className={`rounded-xl p-4 mb-6 text-center ${
            isSuccess
              ? "bg-green-50 border border-green-200"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          <p
            className={`font-semibold text-lg ${
              isSuccess ? "text-green-700" : "text-amber-700"
            }`}
          >
            {isSuccess ? copy.receipt.confirmed : copy.receipt.pending}
          </p>
          {isSuccess && settledDate && (
            <p className="text-sm text-green-600 mt-1">
              {formatDateTime(settledDate, locale)}
            </p>
          )}
          {!isSuccess && (
            <p className="text-sm text-amber-600 mt-1">
              {copy.receipt.pendingDescription}
            </p>
          )}
        </div>

        {/* Payment details */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3 text-sm">
          {student && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">{copy.receipt.student}</span>
                <span className="font-medium">{student.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{copy.receipt.studentId}</span>
                <span className="font-mono text-gray-700">{student.external_id}</span>
              </div>
              {student.class_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{copy.receipt.class}</span>
                  <span>{student.class_name}</span>
                </div>
              )}
            </>
          )}

          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between font-bold text-base">
              <span>{copy.receipt.amountPaid}</span>
              <span>
                {formatMoney(payment.amount, currency, locale)}
              </span>
            </div>
          </div>

          <div className="border-t pt-3 mt-1 space-y-2 text-gray-500">
            <div className="flex justify-between">
              <span>{copy.receipt.provider}</span>
              <span>
                {TELECOM_LABELS[payment.telecom as Telecom] ?? payment.telecom}
              </span>
            </div>
            <div className="flex justify-between">
              <span>{copy.receipt.phone}</span>
              <span className="font-mono">{payment.phone}</span>
            </div>
            {payment.serdipay_transaction_id && (
              <div className="flex justify-between">
                <span>{copy.receipt.transactionRef}</span>
                <span className="font-mono text-xs break-all">
                  {payment.serdipay_transaction_id}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{copy.receipt.reference}</span>
              <span className="font-mono text-xs break-all">{payment.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {!canBrandedReceipts && (
          <p className="text-center text-xs text-gray-400 mt-8">
            {copy.receipt.poweredBy}
          </p>
        )}
      </div>
    </main>
  );
}
