export const dynamic = "force-dynamic";

import Image from "next/image";
import { notFound } from "next/navigation";
import { PayForm } from "../../[schoolCode]/PayForm";
import { resolveStudentPaymentToken } from "@/lib/student-payment-link";
import { getAdminClient } from "@/lib/supabase";
import { computeFee, DEFAULT_PARENT_FEE_BPS } from "@/lib/fee";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { formatMoney } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ReminderPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);
  const { token } = await params;
  const resolved = await resolveStudentPaymentToken(token);
  if (!resolved) notFound();

  const { student, school } = resolved;
  const { data: policy } = await getAdminClient()
    .from("school_pricing_policies")
    .select("parent_fee_bps, fee_display_mode")
    .eq("school_id", school.id)
    .single();

  const { feeAmount, totalAmount } = computeFee(
    Number(student.amount_due),
    policy?.parent_fee_bps ?? DEFAULT_PARENT_FEE_BPS
  );
  const showFee = policy?.fee_display_mode === "visible_line_item" && feeAmount > 0;

  return (
    <main className="relative min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8">
          {school.logo_url && (
            <Image
              src={school.logo_url}
              alt={`${school.name} logo`}
              width={192}
              height={48}
              className="h-12 w-auto mb-3 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold">{school.name}</h1>
          <p className="text-gray-500 text-sm">{copy.access.pageSubtitle}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <p className="font-semibold text-lg">{student.full_name}</p>
          {student.class_name && (
            <p className="text-gray-500 text-sm">{student.class_name}</p>
          )}

          {showFee ? (
            <div className="mt-4 space-y-1 text-sm text-gray-600 border rounded-lg p-3 bg-gray-50">
              <div className="flex justify-between">
                <span>{copy.access.schoolFee}</span>
                <span>{formatMoney(Number(student.amount_due), school.currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>{copy.access.transactionFee}</span>
                <span>{formatMoney(feeAmount, school.currency, locale)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                <span>{copy.access.total}</span>
                <span>{formatMoney(totalAmount, school.currency, locale)}</span>
              </div>
            </div>
          ) : (
            <p className="text-3xl font-bold mt-4">
              {formatMoney(totalAmount, school.currency, locale)}
            </p>
          )}
        </div>

        <PayForm
          studentId={student.external_id}
          amountDue={totalAmount}
          paymentToken={school.payment_access_token}
          currency={school.currency}
        />
      </div>
    </main>
  );
}
