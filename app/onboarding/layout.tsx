import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localizePathname(locale, "/login"));

  return (
    <div className="relative min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
