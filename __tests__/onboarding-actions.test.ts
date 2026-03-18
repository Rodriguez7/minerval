import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createSSRClient: vi.fn(),
  getAdminClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createSchool, updateBillingContact } from "@/app/actions/onboarding";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

function makeFormData(data: Record<string, string>) {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

const validSchoolData = {
  schoolName: "Ecole Saint Michel",
  schoolCode: "saint-michel",
  studentIdPrefix: "ESM",
  currency: "FC",
};

function mockAuth(userId = "uid1", email = "admin@school.com") {
  vi.mocked(createSSRClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email } } }) },
  } as never);
}

function makeAdminChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

describe("createSchool action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid school code (uppercase)", async () => {
    mockAuth();
    const result = await createSchool(null, makeFormData({ ...validSchoolData, schoolCode: "Saint-Michel" }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects if school code already taken", async () => {
    mockAuth();
    const adminChain = makeAdminChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn().mockReturnValue(adminChain) } as never);

    const result = await createSchool(null, makeFormData(validSchoolData));
    expect(result?.error).toBe("School code already taken.");
  });

  it("creates school + membership + subscription + pricing policy", async () => {
    mockAuth();
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "school1" }, error: null }),
      }),
    });
    const insertNoReturn = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn()
      .mockReturnValueOnce({ // uniqueness check
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })
      .mockReturnValueOnce({ insert: insertMock })        // schools.insert
      .mockReturnValueOnce({ insert: insertNoReturn })   // school_memberships.insert
      .mockReturnValueOnce({ insert: insertNoReturn })   // school_subscriptions.insert
      .mockReturnValueOnce({ insert: insertNoReturn });  // school_pricing_policies.insert

    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`REDIRECT:${path}`); });

    await expect(createSchool(null, makeFormData(validSchoolData))).rejects.toThrow("REDIRECT:/onboarding/billing-contact");

    expect(fromMock).toHaveBeenCalledWith("school_memberships");
    expect(fromMock).toHaveBeenCalledWith("school_subscriptions");
    expect(fromMock).toHaveBeenCalledWith("school_pricing_policies");
  });

  it("redirects to /login if not authenticated", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`REDIRECT:${path}`); });

    await expect(createSchool(null, makeFormData(validSchoolData))).rejects.toThrow("REDIRECT:/login");
  });
});

describe("updateBillingContact action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid billing email", async () => {
    mockAuth();
    const result = await updateBillingContact(
      null,
      makeFormData({ billingEmail: "not-an-email", billingContact: "Admin", timezone: "UTC" })
    );
    expect(result?.error).toBeTruthy();
  });

  it("redirects to /login if not authenticated", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`REDIRECT:${path}`); });

    await expect(
      updateBillingContact(null, makeFormData({ billingEmail: "a@b.com", billingContact: "Admin", timezone: "UTC" }))
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("updates school billing fields and redirects to /onboarding/import", async () => {
    mockAuth("uid1", "admin@school.com");

    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const updateMock = vi.fn().mockReturnValue(updateChain);
    const membershipChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { school_id: "school1" }, error: null }),
    };

    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid1", email: "admin@school.com" } } }) },
      from: vi.fn()
        .mockReturnValueOnce(membershipChain)
        .mockReturnValueOnce({ update: updateMock }),
    } as never);
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`REDIRECT:${path}`); });

    await expect(
      updateBillingContact(null, makeFormData({ billingEmail: "billing@school.com", billingContact: "Jean Kabila", timezone: "Africa/Kinshasa" }))
    ).rejects.toThrow("REDIRECT:/onboarding/import");

    expect(updateMock).toHaveBeenCalledWith({
      billing_email: "billing@school.com",
      billing_contact: "Jean Kabila",
      timezone: "Africa/Kinshasa",
    });
  });
});
