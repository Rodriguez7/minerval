import { supabase } from "@/lib/supabase";
import { PayForm } from "./PayForm";

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentId } = await searchParams;

  if (!studentId) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <p className="text-red-600">No student ID provided.</p>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("students")
    .select("external_id, name, amount_due, schools(name)")
    .eq("external_id", studentId)
    .single();

  if (error || !data) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <p className="text-red-600">Student not found.</p>
      </main>
    );
  }

  const student = {
    student_id: data.external_id,
    name: data.name,
    school_name: (data.schools as { name: string } | null)?.name ?? "Unknown School",
    amount_due: data.amount_due,
  };

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">School Fee Payment</h1>
      <p className="text-gray-500 mb-6">{student.school_name}</p>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="font-medium">{student.name}</p>
        <p className="text-sm text-gray-500">ID: {studentId}</p>
        <p className="text-xl font-bold mt-2">{student.amount_due.toLocaleString()} FC</p>
      </div>

      {student.amount_due === 0 ? (
        <p className="text-green-600 font-medium">No fees outstanding.</p>
      ) : (
        <PayForm student={student} />
      )}
    </main>
  );
}
