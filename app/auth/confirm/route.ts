import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase";

const ONBOARDING_PATH = /^\/(fr|en)\/onboarding\/school$/;

function safeOnboardingPath(rawNext: string | null, origin: string) {
  const fallback = "/fr/onboarding/school";
  if (!rawNext) return fallback;

  try {
    const nextUrl = new URL(rawNext, origin);
    if (nextUrl.origin !== origin || !ONBOARDING_PATH.test(nextUrl.pathname)) {
      return fallback;
    }
    return nextUrl.pathname;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeOnboardingPath(
    request.nextUrl.searchParams.get("next"),
    request.nextUrl.origin
  );

  if (tokenHash && type === "email") {
    const supabase = await createSSRClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
    }
  }

  const locale = nextPath.startsWith("/en/") ? "en" : "fr";
  const errorUrl = new URL(`/${locale}/login`, request.nextUrl.origin);
  errorUrl.searchParams.set("error", "confirmation");
  return NextResponse.redirect(errorUrl);
}
