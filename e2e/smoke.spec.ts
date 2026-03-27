import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
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

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: `E2E School ${suffix}`,
      code: schoolCode,
      admin_email: email,
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
    .select("id, status");

  if (paymentsError) {
    await admin.from("students").delete().eq("id", student.id);
    await admin.from("schools").delete().eq("id", school.id);
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(paymentsError.message);
  }

  const successPaymentId = paymentRows?.find((p) => p.status === "success")?.id ?? "";
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

  test("loads dashboard, reconciliation, reports, export, and public payment lookup", async ({
    page,
  }) => {
    await page.goto("/fr/login");
    await page.locator('input[name="email"]').fill(seed.email);
    await page.locator('input[name="password"]').fill(seed.password);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await page.waitForURL("**/fr/dashboard");
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

    // Receipt page — publicly accessible, branded (pro_monthly has can_branded_receipts)
    await page.context().clearCookies();
    await page.goto(`/fr/pay/receipt?ref=${seed.paymentRequestId}`);
    await expect(page.getByText("Paiement confirme")).toBeVisible();
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("heading", { name: seed.schoolName })).toBeVisible();
  });
});
