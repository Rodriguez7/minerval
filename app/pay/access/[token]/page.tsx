export const dynamic = "force-dynamic";

import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";
import { PayForm } from "../../[schoolCode]/PayForm";
import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { computeFee } from "@/lib/fee";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { formatMoney } from "@/lib/i18n/format";
import { getRequestLocale } from "@/lib/i18n/server";
import { renderTemplate } from "@/lib/i18n/template";

export default async function PayAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ student?: string }>;
}) {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);
  const { token } = await params;
  const { student: studentExternalId } = await searchParams;
  const school = await getSchoolByPaymentAccessToken(token);

  if (!school) notFound();

  let student = null;
  let studentError = "";
  let feeAmount = 0;
  let totalAmount = 0;
  let feeDisplayMode: "visible_line_item" | "hidden" = "hidden";

  if (studentExternalId) {
    const rateLimit = consumeRateLimit({
      key: `student-lookup:${school.id}:${getClientIp(await headers())}`,
      limit: 15,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      studentError = renderTemplate(copy.access.tooManyLookupAttempts, {
        seconds: rateLimit.retryAfterSeconds,
      });
    } else {
      const { data, error } = await getAdminClient()
        .from("students")
        .select("id, external_id, full_name, class_name, amount_due")
        .eq("school_id", school.id)
        .eq("external_id", studentExternalId)
        .single();

      if (error || !data) {
        studentError = copy.access.studentNotFound;
      } else {
        student = data;

        // Fetch pricing policy to compute parent fee
        const { data: policy } = await getAdminClient()
          .from("school_pricing_policies")
          .select("parent_fee_bps, fee_display_mode")
          .eq("school_id", school.id)
          .single();

        const computed = computeFee(
          student.amount_due,
          policy?.parent_fee_bps ?? 275
        );
        feeAmount = computed.feeAmount;
        totalAmount = computed.totalAmount;
        feeDisplayMode =
          (policy?.fee_display_mode as "visible_line_item" | "hidden") ??
          "hidden";
      }
    }
  }

  const currency = school.currency ?? "FC";

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

        {!studentExternalId && <StudentSearch label={copy.access.searchLabel} placeholder={copy.access.searchPlaceholder} buttonLabel={copy.access.searchButton} />}

        {studentExternalId && studentError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{studentError}</p>
          </div>
        )}

        {student && (
          <>
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <p className="font-semibold text-lg">{student.full_name}</p>
              {student.class_name && (
                <p className="text-gray-500 text-sm">{student.class_name}</p>
              )}
              <p className="text-sm text-gray-400 mt-1">{copy.access.studentIdLabel}: {student.external_id}</p>

              {feeDisplayMode === "visible_line_item" && feeAmount > 0 ? (
                <div className="mt-4 space-y-1 text-sm text-gray-600 border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between">
                    <span>{copy.access.schoolFee}</span>
                    <span>{formatMoney(student.amount_due, currency, locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{copy.access.transactionFee}</span>
                    <span>{formatMoney(feeAmount, currency, locale)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                    <span>{copy.access.total}</span>
                    <span>{formatMoney(totalAmount, currency, locale)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-3xl font-bold mt-4">
                  {formatMoney(totalAmount, currency, locale)}
                </p>
              )}
            </div>

            {student.amount_due <= 0 ? (
              <p className="text-green-700 font-medium">{copy.access.allPaid}</p>
            ) : (
              <PayForm
                studentId={student.external_id}
                amountDue={totalAmount}
                paymentToken={token}
                currency={currency}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StudentSearch({
  label,
  placeholder,
  buttonLabel,
}: {
  label: string;
  placeholder: string;
  buttonLabel: string;
}) {
  return (
    <form method="GET" className="bg-white rounded-xl shadow p-6">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        name="student"
        type="text"
        required
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 mb-4"
      />
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
