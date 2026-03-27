import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
  getLocaleFromPathname,
  getPreferredLocale,
  localizePathname,
  stripLocaleFromPathname,
  type AppLocale,
} from "@/lib/i18n/config";

function buildLocalizedResponse(
  request: NextRequest,
  locale: AppLocale,
  pathname: string
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, locale);

  if (request.nextUrl.pathname === pathname) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname;
  return NextResponse.rewrite(rewriteUrl, {
    request: { headers: requestHeaders },
  });
}

function setLocaleCookie(response: NextResponse, locale: AppLocale) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const localeFromHeader = request.headers.get(LOCALE_HEADER_NAME);
  const localeFromPath = getLocaleFromPathname(request.nextUrl.pathname);
  const locale = getPreferredLocale(
    localeFromPath ?? localeFromHeader ?? request.cookies.get(LOCALE_COOKIE_NAME)?.value
  );

  if (!localeFromPath) {
    // Internal rewrites strip the locale prefix. On the second middleware pass we
    // keep the rewritten pathname and only forward the locale header/cookie.
    if (localeFromHeader) {
      return setLocaleCookie(
        NextResponse.next({
          request: { headers: request.headers },
        }),
        locale
      );
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localizePathname(locale, request.nextUrl.pathname);

    return setLocaleCookie(NextResponse.redirect(redirectUrl), locale);
  }

  const pathname = stripLocaleFromPathname(request.nextUrl.pathname);
  const isProtectedPath =
    pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

  let supabaseResponse = setLocaleCookie(
    buildLocalizedResponse(request, locale, pathname),
    locale
  );

  if (!isProtectedPath) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = setLocaleCookie(
            buildLocalizedResponse(request, locale, pathname),
            locale
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = localizePathname(locale, "/login");
    return setLocaleCookie(NextResponse.redirect(url), locale);
  }

  // Check subscription status for dashboard routes (except billing itself)
  if (
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/dashboard/billing")
  ) {
    const { data } = await supabase
      .from("school_memberships")
      .select(
        "schools!inner(school_subscriptions!inner(status, billing_exempt))"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    type SubRow = { status: string; billing_exempt: boolean };
    type SchoolRow = { school_subscriptions: SubRow[] };

    // Supabase returns nested joins as arrays even for one-to-one relationships
    const schoolsData = data?.schools;
    const schoolRow = (
      Array.isArray(schoolsData) ? schoolsData[0] : schoolsData
    ) as SchoolRow | null;
    const sub = schoolRow?.school_subscriptions?.[0];

    const isExpired =
      !sub?.billing_exempt &&
      (sub?.status === "past_due" || sub?.status === "canceled");

    if (isExpired) {
      const url = request.nextUrl.clone();
      url.pathname = localizePathname(locale, "/dashboard/billing");
      url.searchParams.set("expired", "1");
      return setLocaleCookie(NextResponse.redirect(url), locale);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)"],
};
