import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
      url.pathname = "/dashboard/billing";
      url.searchParams.set("expired", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
