"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { getDashboardShellCopy } from "@/lib/i18n/copy/dashboard";
import { stripLocaleFromPathname } from "@/lib/i18n/config";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";

export function MobileNav({ schoolName }: { schoolName: string }) {
  const [open, setOpen] = useState(false);
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

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Mobile top bar — only visible below md */}
      <div className="md:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200">
        <div>
          <span className="text-sm font-bold text-zinc-950">Minerval</span>
          <p className="text-xs text-zinc-400 leading-none mt-0.5 truncate max-w-[180px]">{schoolName}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors"
          aria-label={copy.openMenu}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="4.5" x2="16" y2="4.5" />
            <line x1="2" y1="9" x2="16" y2="9" />
            <line x1="2" y1="13.5" x2="16" y2="13.5" />
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white flex flex-col shadow-xl transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-zinc-950">Minerval</span>
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[160px]">{schoolName}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500"
            aria-label={copy.closeMenu}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navItems.map(({ href, label, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <LocalizedLink
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
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
      </div>
    </>
  );
}
