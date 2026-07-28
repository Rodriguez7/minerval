import { redirect } from "next/navigation";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function LegacyAdminPayoutsPage() {
  const locale = await getRequestLocale();
  redirect(localizePathname(locale, "/admin/payouts"));
}
