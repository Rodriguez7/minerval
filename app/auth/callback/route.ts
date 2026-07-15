import { type NextRequest, NextResponse } from "next/server";
import { getSafeAuthNext } from "@/lib/auth-redirect";
import { getPreferredLocale } from "@/lib/i18n/config";
import { createSSRClient } from "@/lib/supabase";

function getAppOrigin() {
  return new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org"
  ).origin;
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin();
  const locale = getPreferredLocale(
    request.nextUrl.pathname.split("/").find((segment) => segment === "fr" || segment === "en")
  );
  const next = getSafeAuthNext(request.nextUrl.searchParams.get("next"), locale);
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSSRClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, appOrigin));
  }

  const errorUrl = new URL(`/${locale}/login`, appOrigin);
  errorUrl.searchParams.set("error", "oauth");
  return NextResponse.redirect(errorUrl);
}
