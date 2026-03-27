"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { getDashboardShellCopy } from "@/lib/i18n/copy/dashboard";
import { stripLocaleFromPathname } from "@/lib/i18n/config";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";

export function NavLinks() {
  const locale = useLocale();
  const copy = getDashboardShellCopy(locale);
  const pathname = stripLocaleFromPathname(usePathname());
  const navItems = [
    { href: "/dashboard", label: copy.nav.overview, exact: true },
    { href: "/dashboard/students", label: copy.nav.students },
    { href: "/dashboard/fees", label: copy.nav.fees },
    { href: "/dashboard/reconciliation", label: copy.nav.reconciliation },
    { href: "/dashboard/reports", label: copy.nav.reports },
    { href: "/dashboard/payouts", label: copy.nav.payouts },
    { href: "/dashboard/analytics", label: copy.nav.analytics },
    { href: "/dashboard/team", label: copy.nav.team },
    { href: "/dashboard/billing", label: copy.nav.billing },
    { href: "/dashboard/settings", label: copy.nav.settings },
  ];

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {navItems.map(({ href, label, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
        return (
          <LocalizedLink
            key={href}
            href={href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            {label}
          </LocalizedLink>
        );
      })}
    </nav>
  );
}
