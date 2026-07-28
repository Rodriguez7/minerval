import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { buildPageHref, getTotalPages } from "@/lib/pagination";
import { getRequestLocale } from "@/lib/i18n/server";

export async function Pagination({
  basePath,
  page,
  pageSize,
  searchParams,
  totalItems,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
  totalItems: number;
}) {
  const fr = (await getRequestLocale()) === "fr";
  const totalPages = getTotalPages(totalItems, pageSize);
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm"
    >
      <LocalizedLink
        href={buildPageHref(basePath, searchParams, page - 1)}
        aria-disabled={page <= 1}
        className={`rounded-lg border px-3 py-1.5 ${
          page <= 1
            ? "pointer-events-none border-zinc-100 text-zinc-300"
            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        {fr ? "Précédent" : "Previous"}
      </LocalizedLink>
      <span className="text-zinc-500">
        {fr ? `Page ${page} sur ${totalPages}` : `Page ${page} of ${totalPages}`}
      </span>
      <LocalizedLink
        href={buildPageHref(basePath, searchParams, page + 1)}
        aria-disabled={page >= totalPages}
        className={`rounded-lg border px-3 py-1.5 ${
          page >= totalPages
            ? "pointer-events-none border-zinc-100 text-zinc-300"
            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
        }`}
      >
        {fr ? "Suivant" : "Next"}
      </LocalizedLink>
    </nav>
  );
}
