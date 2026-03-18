import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { CsvImportForm } from "@/app/dashboard/students/CsvImportForm";
import Link from "next/link";

export default async function OnboardingImportPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/onboarding/school");

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow px-8 pt-6 pb-2">
        <p className="text-sm text-blue-600 font-medium">Step 3 of 3</p>
        <h1 className="text-2xl font-bold mt-1">Import your students</h1>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Upload a CSV to add your student roster. You can also do this later from the
          Students page.
        </p>
      </div>
      <CsvImportForm />
      <div className="flex justify-end">
        <Link
          href="/onboarding/done"
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Skip, I&apos;ll add students later →
        </Link>
      </div>
    </div>
  );
}
