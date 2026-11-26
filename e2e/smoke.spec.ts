import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type SeedContext = {
  email: string;
  password: string;
  schoolCode: string;
  schoolId: string;
  studentExternalId: string;
  studentId: string;
  userId: string;
  paymentToken: string;
  paymentRequestId: string;
  receiptAccessToken: string;
  schoolName: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAdminClient() {
  return createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getAnonClient() {
  return createClient(getRequiredEnv("SUPABASE_URL"), getRequiredEnv("SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabaseProjectRef() {
  const url = new URL(getRequiredEnv("SUPABASE_URL"));
  return url.hostname.split(".")[0] ?? "";
}

/**
 * Matches French UI copy regardless of accents and apostrophe style, so
 * typographic polish ("l'ecole" -> "l’école") does not break the suite while
 * the wording itself is still checked.
 */
function fr(text: string) {
  const variants: Record<string, string> = {
    a: "[aàâä]",
    c: "[cç]",
    e: "[eéèêë]",
    i: "[iîï]",
    o: "[oôö]",
    u: "[uùûü]",
    "'": "['’]",
  };
  const pattern = [...text]
    .map((char) => variants[char.toLowerCase()] ?? char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
  return new RegExp(pattern, "i");
}

function getTargetUrl() {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Playwright baseURL is not configured");
  return new URL(baseURL);
}

/**
 * Production Supabase requires a captcha for password sign-in, so the seeded
 * user's session comes from an admin-generated magic link instead. Nothing is
 * emailed, and this works whether or not captcha protection is enabled.
 */
async function createSession(email: string) {
  const admin = getAdminClient();
  const anon = getAnonClient();
  let lastError = "unknown error";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;

    if (!linkError && tokenHash) {
      const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (!error && data.session) return data.session;
      lastError = error?.message ?? "no session returned";
    } else {
      lastError = linkError?.message ?? "no token returned";
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Seeded auth user ${email} could not get a session: ${lastError}`);
}

async function authenticatePage(page: Page, email: string) {
  const session = await createSession(email);
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  const projectRef = getSupabaseProjectRef();
  const target = getTargetUrl();
  const cookieDefaults = {
    domain: target.hostname,
    path: "/",
    httpOnly: false,
    secure: target.protocol === "https:",
    sameSite: "Lax" as const,
  };

  await page.context().addCookies([
    { name: "minerval-locale", value: "fr", ...cookieDefaults },
    { name: `sb-${projectRef}-auth-token`, value: cookieValue, ...cookieDefaults },
  ]);
}

async function createSeedContext(admin: SupabaseClient): Promise<SeedContext> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `e2e-${suffix}@example.com`;
  const password = `Minerval!${suffix}`;
  const schoolCode = `e2e-${suffix}`;

  const authResult = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authResult.error || !authResult.data.user) {
    throw new Error(authResult.error?.message ?? "Failed to create auth user");
  }

  const user = authResult.data.user as User;
  try {
    await createSession(email);
  } catch (error) {
    await admin.auth.admin.deleteUser(user.id);
    throw error;
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: `E2E School ${suffix}`,
      code: schoolCode,
      admin_email: email,
      billing_email: email,
      billing_contact: "E2E Billing Contact",
      timezone: "Africa/Kinshasa",
    })
    .select("id, payment_access_token")
    .single();

  if (schoolError || !school) {
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(schoolError?.message ?? "Failed to create school");
  }

  const { error: membershipError } = await admin.from("school_memberships").insert({
    user_id: user.id,
    school_id: school.id,
    role: "owner",
    status: "active",
  });

  if (membershipError) {
    await admin.from("schools").delete().eq("id", school.id);
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(membershipError.message);
  }

  // Upsert to pro_monthly so smoke test has all entitlements.
  // The DB trigger creates starter_free on school insert, so we must upsert (not insert) to overwrite it.
  await admin.from("school_subscriptions").upsert(
    { school_id: school.id, plan_code: "pro_monthly", status: "active" },
    { onConflict: "school_id" }
  );

  // Seed pricing policy with 0 bps so the payment button total matches the student's amount_due.
  // (avoids test brittleness if the default fee changes in future)
  await admin.from("school_pricing_policies").upsert(
    { school_id: school.id, parent_fee_bps: 0, fee_display_mode: "hidden" },
    { onConflict: "school_id" }
  );

  const { data: student, error: studentError } = await admin
    .from("students")
    .insert({
      school_id: school.id,
      external_id: `STU-${suffix.toUpperCase()}`,
      full_name: "Playwright Student",
      class_name: "6A",
      amount_due: 1500,
    })
    .select("id, external_id")
    .single();

  if (studentError || !student) {
    await admin.from("schools").delete().eq("id", school.id);
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(studentError?.message ?? "Failed to create student");
  }

  const staleTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const settledTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: paymentRows, error: paymentsError } = await admin
    .from("payment_requests")
    .insert([
      {
        student_id: student.id,
        school_id: school.id,
        amount: 1500,
        phone: "243812345678",
        telecom: "AM",
        status: "pending",
        reconciliation_status: "needs_review",
        reconciliation_note: "Seeded exception for Playwright smoke test.",
        reconciliation_updated_at: staleTimestamp,
        reconciliation_updated_by: "e2e",
        created_at: staleTimestamp,
        updated_at: staleTimestamp,
      },
      {
        student_id: student.id,
        school_id: school.id,
        amount: 1500,
        phone: "243812345678",
        telecom: "OM",
        status: "success",
        reconciliation_status: "reconciled",
        reconciliation_updated_at: settledTimestamp,
        reconciliation_updated_by: "e2e",
        created_at: settledTimestamp,
        updated_at: settledTimestamp,
        settled_at: settledTimestamp,
        serdipay_transaction_id: `E2E-${suffix.toUpperCase()}`,
      },
    ])
    .select("id, status, receipt_access_token");

  if (paymentsError) {
    await admin.from("students").delete().eq("id", student.id);
    await admin.from("schools").delete().eq("id", school.id);
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(paymentsError.message);
  }

  const successPaymentId = paymentRows?.find((p) => p.status === "success")?.id ?? "";
  const receiptAccessToken =
    paymentRows?.find((p) => p.status === "success")?.receipt_access_token ?? "";
  const schoolName = `E2E School ${suffix}`;

  return {
    email,
    password,
    schoolCode,
    schoolId: school.id,
    studentExternalId: student.external_id,
    studentId: student.id,
    userId: user.id,
    paymentToken: school.payment_access_token,
    paymentRequestId: successPaymentId,
    receiptAccessToken,
    schoolName,
  };
}

async function cleanupSeedContext(admin: SupabaseClient, seed: SeedContext) {
  const { data: payments } = await admin
    .from("payment_requests")
    .select("id")
    .eq("school_id", seed.schoolId);
  const paymentIds = (payments ?? []).map((payment) => payment.id);
  if (paymentIds.length > 0) {
    await admin.from("payment_events").delete().in("payment_request_id", paymentIds);
  }
  await admin.from("payment_requests").delete().eq("school_id", seed.schoolId);
  await admin.from("students").delete().eq("school_id", seed.schoolId);
  await admin.from("schools").delete().eq("id", seed.schoolId);
  await admin.auth.admin.deleteUser(seed.userId);
}

test.describe.serial("Minerval smoke", () => {
  const admin = getAdminClient();
  let seed: SeedContext;

  // Optional: E2E_ORIGIN_URL (e.g. an SSH tunnel to the server's reverse proxy)
  // answers every browser request for the target host directly, bypassing the
  // CDN. Needed to test the geo-restricted dashboard from outside the DRC.
  const originUrl = process.env.E2E_ORIGIN_URL;

  test.beforeEach(async ({ context }) => {
    if (!originUrl) return;
    const target = getTargetUrl();

    await context.route(
      (url) => url.hostname === target.hostname,
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const response = await route.fetch({
          url: `${originUrl.replace(/\/$/, "")}${url.pathname}${url.search}`,
          headers: { ...(await request.allHeaders()), host: url.host, "x-forwarded-proto": "https" },
          maxRedirects: 0,
        });
        const headers = { ...response.headers() };
        // Otherwise the browser upgrades later requests to HTTPS and leaves the origin.
        delete headers["strict-transport-security"];
        await route.fulfill({ response, headers });
      }
    );
  });

  test.afterEach(async ({ context }) => {
    if (originUrl) await context.unrouteAll({ behavior: "ignoreErrors" });
  });

  test.beforeAll(async () => {
    seed = await createSeedContext(admin);
  });

  test.afterAll(async () => {
    if (seed) {
      await cleanupSeedContext(admin, seed);
    }
  });

  test("landing page is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/fr");

    await expect(
      page.getByRole("heading", { level: 1, name: fr("Automatisez le recouvrement des frais scolaires") })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: fr("Creer mon ecole gratuitement") }).first()).toBeVisible();

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(metrics.scrollWidth).toBe(metrics.innerWidth);

    const response = await page.request.get("/fr");
    expect(response.headers()["strict-transport-security"]).toContain("max-age=63072000");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["permissions-policy"]).toContain("camera=()");
  });

  test("loads dashboard, reconciliation, reports, export, and public payment lookup", async ({
    page,
  }) => {
    await authenticatePage(page, seed.email);

    await page.goto("/fr/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: fr("Vue d'ensemble") })).toBeVisible();
    await expect(page.getByText(fr("QR de paiement de l'etablissement"))).toBeVisible();

    await page.goto("/fr/dashboard/reconciliation");
    await expect(page.getByRole("heading", { name: "Rapprochement", exact: true })).toBeVisible();
    await expect(page.getByText(fr("File d'exceptions"))).toBeVisible();
    await expect(page.getByText(seed.studentExternalId)).toBeVisible();

    await page.goto("/fr/dashboard/reports");
    await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
    await expect(page.getByText(fr("Synthese journaliere"))).toBeVisible();

    // Fetched from inside the page, like an admin's download, so it shares the
    // browser's cookies and routing (including E2E_ORIGIN_URL).
    const exportResponse = await page.evaluate(async () => {
      const response = await fetch("/fr/dashboard/reports/export", { credentials: "include" });
      return {
        ok: response.ok,
        contentType: response.headers.get("content-type") ?? "",
        body: await response.text(),
      };
    });
    expect(exportResponse.ok).toBeTruthy();
    expect(exportResponse.contentType).toContain("text/csv");
    expect(exportResponse.body).toContain(seed.studentExternalId);

    // Payouts page
    await page.goto("/fr/dashboard/payouts");
    await expect(page.getByRole("heading", { name: "Versements" })).toBeVisible();
    await expect(page.getByText(fr("Net pour l'ecole"))).toBeVisible();

    // Analytics page (pro_monthly has can_advanced_analytics)
    await page.goto("/fr/dashboard/analytics");
    await expect(page.getByRole("heading", { name: "Analytique" })).toBeVisible();
    await expect(page.getByText(fr("Taux de succes"))).toBeVisible();

    // Settings page — payout discount (pro_monthly has 50 bps = 0.50% discount)
    await page.goto("/fr/dashboard/settings");
    await expect(page.getByText("Remise sur les versements")).toBeVisible();
    await expect(page.getByText("0.50%")).toBeVisible();
    await expect(page.getByRole("heading", { name: fr("Logo de l'etablissement") })).toBeVisible();

    await page.goto(`/fr/pay/access/${seed.paymentToken}?student=${seed.studentExternalId}`);
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("button", { name: /Payer .*1.*500 FC/ })).toBeVisible();

    await page.goto(`/fr/pay/access/${seed.paymentToken}?student=UNKNOWN-STUDENT`);
    await expect(page.getByText(fr("Eleve introuvable"))).toBeVisible();
    await expect(page.getByLabel(fr("Entrez votre ID eleve"))).toHaveValue("UNKNOWN-STUDENT");
    await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();

    // Receipt page — publicly accessible, branded (pro_monthly has can_branded_receipts)
    await page.context().clearCookies();
    await page.goto(`/fr/pay/receipt?token=${seed.receiptAccessToken}`);
    await expect(page.getByText(fr("Paiement confirme"))).toBeVisible();
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("heading", { name: seed.schoolName })).toBeVisible();
  });

  test("SerdiPay callback settles a pending payment once and refuses forgeries", async ({ request }) => {
    const secret = process.env.SERDIPAY_CALLBACK_SECRET;
    test.skip(!secret, "SERDIPAY_CALLBACK_SECRET is not set for this environment");

    // Simulates SerdiPay's server-to-server confirmation; no money moves.
    const { data: pending } = await admin
      .from("payment_requests")
      .select("id")
      .eq("school_id", seed.schoolId)
      .eq("status", "pending")
      .single();
    expect(pending, "the seed includes one pending payment").toBeTruthy();

    const callbackUrl = `/api/serdipay/callback?secret=${encodeURIComponent(secret!)}`;
    const payload = {
      message: pending!.id,
      status: 200,
      payment: { status: "success", transactionId: `E2E-CB-${pending!.id.slice(0, 8)}` },
    };

    const forged = await request.post("/api/serdipay/callback?secret=wrong", { data: payload });
    expect(forged.status()).toBe(401);

    const first = await request.post(callbackUrl, { data: payload });
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ message: "OK" });

    const { data: settled } = await admin
      .from("payment_requests")
      .select("status, reconciliation_status, settled_at, serdipay_transaction_id")
      .eq("id", pending!.id)
      .single();
    expect(settled).toMatchObject({
      status: "success",
      reconciliation_status: "reconciled",
      serdipay_transaction_id: payload.payment.transactionId,
    });
    expect(settled?.settled_at).toBeTruthy();

    const { data: student } = await admin
      .from("students")
      .select("amount_due")
      .eq("id", seed.studentId)
      .single();
    expect(Number(student?.amount_due)).toBe(0);

    // SerdiPay retries callbacks: a replay must not settle the payment twice.
    const replay = await request.post(callbackUrl, { data: payload });
    expect(await replay.json()).toEqual({ message: "Deja traite" });

    const { count } = await admin
      .from("payment_events")
      .select("id", { count: "exact", head: true })
      .eq("payment_request_id", pending!.id)
      .eq("event_type", "callback_success");
    expect(count).toBe(1);
  });
});
