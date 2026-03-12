import { getAuthenticatedSchool } from "@/lib/auth";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const school = await getAuthenticatedSchool();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg">Minerval</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600 font-medium">{school.name}</span>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Overview
          </Link>
          <Link href="/dashboard/students" className="text-sm text-gray-600 hover:text-gray-900">
            Students
          </Link>
          <Link href="/dashboard/fees" className="text-sm text-gray-600 hover:text-gray-900">
            Fees
          </Link>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
            Log out
          </button>
        </form>
      </nav>
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
