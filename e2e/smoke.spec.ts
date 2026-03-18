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

  const { error: paymentsError } = await admin.from("payment_requests").insert([
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
  ]);

  if (paymentsError) {
    await admin.from("students").delete().eq("id", student.id);
    await admin.from("schools").delete().eq("id", school.id);
    await admin.auth.admin.deleteUser(user.id);
    throw new Error(paymentsError.message);
  }

  return {
    email,
    password,
    schoolCode,
    schoolId: school.id,
    studentExternalId: student.external_id,
    studentId: student.id,
    userId: user.id,
    paymentToken: school.payment_access_token,
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
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(seed.email);
    await page.locator('input[name="password"]').fill(seed.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("School Payment QR")).toBeVisible();

    await page.goto("/dashboard/reconciliation");
    await expect(page.getByRole("heading", { name: "Reconciliation" })).toBeVisible();
    await expect(page.getByText("Exception Queue")).toBeVisible();
    await expect(page.getByText(seed.studentExternalId)).toBeVisible();

    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByText("Daily Rollup")).toBeVisible();

    const exportResponse = await page.context().request.get("/dashboard/reports/export");
    expect(exportResponse.ok()).toBeTruthy();
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    expect(await exportResponse.text()).toContain(seed.studentExternalId);

    await page.goto(`/pay/access/${seed.paymentToken}?student=${seed.studentExternalId}`);
    await expect(page.getByText("Playwright Student")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay 1,500 FC/ })).toBeVisible();
  });
});
