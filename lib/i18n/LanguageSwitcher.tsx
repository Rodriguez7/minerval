"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { APP_LOCALES, localizeHref } from "./config";
import { useI18n, useLocale } from "./client";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { messages } = useI18n();

  const search = searchParams.toString();
  const currentHref = `${pathname}${search ? `?${search}` : ""}`;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur ${className}`}
    >
      {APP_LOCALES.map((option) => {
        const isActive = option === locale;
        const label = messages.common.languages[option];
        const href = localizeHref(option, currentHref);

        if (isActive) {
          return (
            <span
              key={option}
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
            >
              {label}
            </span>
          );
        }

        return (
          <Link
            key={option}
            href={href}
            className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
