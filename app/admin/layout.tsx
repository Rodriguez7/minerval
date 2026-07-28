import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPlatformAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const user = await getPlatformAdmin();
  if (!user) {
    redirect(localizePathname(locale, "/dashboard"));
  }

  const fr = locale === "fr";
  const links = [
    { href: "/admin", label: fr ? "Vue d’ensemble" : "Overview" },
    {
      href: "/admin/schools",
      label: fr ? "Établissements" : "Schools",
    },
    {
      href: "/admin/payouts",
      label: fr ? "Versements" : "Payouts",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-50">
      <header className="border-b border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <LocalizedLink href="/admin" className="no-underline">
              <span className="text-base font-bold tracking-tight text-white">
                Minerval
              </span>
              <span className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Admin
              </span>
            </LocalizedLink>
            <span className="text-xs text-zinc-500 lg:hidden">
              {user.email}
            </span>
          </div>

          <nav className="flex gap-1 overflow-x-auto">
            {links.map((link) => (
              <LocalizedLink
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 no-underline transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </LocalizedLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-xs text-zinc-400 lg:inline">
              {user.email}
            </span>
            <LanguageSwitcher />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                {fr ? "Déconnexion" : "Log out"}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
