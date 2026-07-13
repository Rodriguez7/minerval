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

async function waitForAuthReadiness(email: string, password: string) {
  const auth = getAnonClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await auth.auth.signInWithPassword({ email, password });
    if (!error) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Seeded auth user ${email} was not ready for sign-in`);
}

async function authenticatePage(page: Page, email: string, password: string) {
  const auth = getAnonClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(error?.message ?? `Failed to sign in seeded user ${email}`);
  }

  const cookieValue = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64")}`;
  const projectRef = getSupabaseProjectRef();

  await page.context().addCookies([
    {
      name: "minerval-locale",
      value: "fr",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
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
  await waitForAuthReadiness(email, password);

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
  await admin.from("payment_requests").delete().eq("school_id", seed.schoolId);
  await admin.from("students").delete().eq("school_id", seed.schoolId);
  await admin.from("schools").delete().eq("id", seed.schoolId);
  await admin.auth.admin.deleteUser(seed.userId);
}

test.describe.serial("Minerval smoke", () => {
  const admin = getAdminClient();
  let seed: SeedContext;

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

    await expect(page.getByRole("heading", { name: /Arretez de courir/i })).toBeVisible();
    await expect(page.getByRole("navigation").getByText("Comment ca marche")).toBeHidden();
    await expect(page.getByRole("link", { name: "Creer votre ecole — gratuit" }).first()).toBeVisible();
    await expect(page.getByText("Trois etapes entre l'inscription")).toBeVisible();

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
    await authenticatePage(page, seed.email, seed.password);

    await page.goto("/fr/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
    await expect(page.getByText("QR de paiement de l'ecole")).toBeVisible();

    await page.goto("/fr/dashboard/reconciliation");
    await expect(page.getByRole("heading", { name: "Rapprochement" })).toBeVisible();
    await expect(page.getByText("File d'exceptions")).toBeVisible();
    await expect(page.getByText(seed.studentExternalId)).toBeVisible();

    await page.goto("/fr/dashboard/reports");
    await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
    await expect(page.getByText("Synthese journaliere")).toBeVisible();

    const exportResponse = await page.context().request.get("/fr/dashboard/reports/export");
    expect(exportResponse.ok()).toBeTruthy();
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    expect(await exportResponse.text()).toContain(seed.studentExternalId);

    // Payouts page
    await page.goto("/fr/dashboard/payouts");
    await expect(page.getByRole("heading", { name: "Versements" })).toBeVisible();
    await expect(page.getByText("Net pour l'ecole")).toBeVisible();

    // Analytics page (pro_monthly has can_advanced_analytics)
    await page.goto("/fr/dashboard/analytics");
    await expect(page.getByRole("heading", { name: "Analytique" })).toBeVisible();
    await expect(page.getByText("Taux de succes")).toBeVisible();

    // Settings page — payout discount (pro_monthly has 50 bps = 0.50% discount)
    await page.goto("/fr/dashboard/settings");
    await expect(page.getByText("Remise sur les versements")).toBeVisible();
    await expect(page.getByText("0.50%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Logo de l'ecole" })).toBeVisible();

    await page.goto(`/fr/pay/access/${seed.paymentToken}?student=${seed.studentExternalId}`);
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("button", { name: /Payer .*1.*500 FC/ })).toBeVisible();

    await page.goto(`/fr/pay/access/${seed.paymentToken}?student=UNKNOWN-STUDENT`);
    await expect(page.getByText("Eleve introuvable")).toBeVisible();
    await expect(page.getByLabel("Entrez votre ID eleve")).toHaveValue("UNKNOWN-STUDENT");
    await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();

    // Receipt page — publicly accessible, branded (pro_monthly has can_branded_receipts)
    await page.context().clearCookies();
    await page.goto(`/fr/pay/receipt?token=${seed.receiptAccessToken}`);
    await expect(page.getByText("Paiement confirme")).toBeVisible();
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("heading", { name: seed.schoolName })).toBeVisible();
  });
});
