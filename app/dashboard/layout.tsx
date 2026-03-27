import { getAuthenticatedSchool } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { getDashboardShellCopy } from "@/lib/i18n/copy/dashboard";
import { getRequestLocale } from "@/lib/i18n/server";
import { NavLinks } from "./NavLinks";
import { MobileNav } from "./MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const copy = getDashboardShellCopy(locale);
  const school = await getAuthenticatedSchool();

  return (
    <div className="flex min-h-[100dvh] bg-zinc-50">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <aside className="hidden md:flex w-[220px] shrink-0 sticky top-0 h-screen bg-white border-r border-zinc-200 flex-col">
        {/* Brand */}
        <div className="px-6 pt-6 pb-5 border-b border-zinc-100">
          <span className="text-sm font-bold tracking-tight text-zinc-950">
            Minerval
          </span>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{school.name}</p>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>

        {/* Logout */}
        <div className="px-3 pb-4 border-t border-zinc-100 pt-3">
          <form action={logout}>
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm text-zinc-400 hover:text-zinc-600 text-left rounded-lg hover:bg-zinc-50 transition-colors"
            >
              {copy.logout}
            </button>
          </form>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar + drawer */}
        <MobileNav schoolName={school.name} />

        {/* Page content */}
        <main className="flex-1">
          <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
