import { redirect } from "next/navigation";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LegacyAdminPage() {
  const locale = await getRequestLocale();
  redirect(localizePathname(locale, "/admin"));
}
