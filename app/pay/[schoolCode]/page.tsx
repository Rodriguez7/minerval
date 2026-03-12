import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";
import { PayForm } from "./PayForm";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolCode: string }>;
  searchParams: Promise<{ student?: string }>;
}) {
  const { schoolCode } = await params;
  const { student: studentExternalId } = await searchParams;

  const { data: school } = await getAdminClient()
    .from("schools")
    .select("id, name, code")
    .eq("code", schoolCode)
    .single();

  if (!school) notFound();

  let student = null;
  let studentError = "";

  if (studentExternalId) {
    const { data, error } = await getAdminClient()
      .from("students")
      .select("id, external_id, full_name, class_name, amount_due")
      .eq("school_id", school.id)
      .eq("external_id", studentExternalId)
      .single();

    if (error || !data) studentError = "Student not found. Check your ID and try again.";
    else student = data;
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{school.name}</h1>
          <p className="text-gray-500 text-sm">School Fee Payment</p>
        </div>

        {!studentExternalId && (
          <StudentSearch />
        )}

        {studentExternalId && studentError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{studentError}</p>
          </div>
        )}

        {student && (
          <>
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <p className="font-semibold text-lg">{student.full_name}</p>
              {student.class_name && <p className="text-gray-500 text-sm">{student.class_name}</p>}
              <p className="text-sm text-gray-400 mt-1">ID: {student.external_id}</p>
              <p className="text-3xl font-bold mt-4">{student.amount_due.toLocaleString()} FC</p>
            </div>

            {student.amount_due <= 0 ? (
              <p className="text-green-700 font-medium">No outstanding fees. All paid!</p>
            ) : (
              <PayForm
                studentId={student.external_id}
                amountDue={student.amount_due}
                schoolCode={schoolCode}
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
