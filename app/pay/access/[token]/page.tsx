export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";
import { PayForm } from "../../[schoolCode]/PayForm";
import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

export default async function PayAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ student?: string }>;
}) {
  const { token } = await params;
  const { student: studentExternalId } = await searchParams;
  const school = await getSchoolByPaymentAccessToken(token);

  if (!school) notFound();

  let student = null;
  let studentError = "";

  if (studentExternalId) {
    const rateLimit = consumeRateLimit({
      key: `student-lookup:${school.id}:${getClientIp(await headers())}`,
      limit: 15,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      studentError = `Too many lookup attempts. Please wait ${rateLimit.retryAfterSeconds} seconds and try again.`;
    } else {
      const { data, error } = await getAdminClient()
        .from("students")
        .select("id, external_id, full_name, class_name, amount_due")
        .eq("school_id", school.id)
        .eq("external_id", studentExternalId)
        .single();

      if (error || !data) {
        studentError = "Student not found. Check your ID and try again.";
      } else {
        student = data;
      }
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{school.name}</h1>
          <p className="text-gray-500 text-sm">School Fee Payment</p>
        </div>

        {!studentExternalId && <StudentSearch />}

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
              <p className="text-sm text-gray-400 mt-1">ID: {student.external_id}</p>
              <p className="text-3xl font-bold mt-4">
                {student.amount_due.toLocaleString()} {school.currency ?? "FC"}
              </p>
            </div>

            {student.amount_due <= 0 ? (
              <p className="text-green-700 font-medium">No outstanding fees. All paid!</p>
            ) : (
              <PayForm
                studentId={student.external_id}
                amountDue={student.amount_due}
                paymentToken={token}
                currency={school.currency ?? "FC"}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StudentSearch() {
  return (
    <form method="GET" className="bg-white rounded-xl shadow p-6">
      <label className="block text-sm font-medium mb-2">Enter your Student ID</label>
      <input
        name="student"
        type="text"
        required
        placeholder="e.g. STU-001"
        className="w-full border rounded-lg px-3 py-2 mb-4"
      />
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium"
      >
        Look up
      </button>
    </form>
  );
}
