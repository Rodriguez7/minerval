import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authGetUser,
  schoolSingle,
  schoolUpdateEq,
  auditInsert,
  sendDecisionEmail,
} = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  schoolSingle: vi.fn(),
  schoolUpdateEq: vi.fn(),
  auditInsert: vi.fn(),
  sendDecisionEmail: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createSSRClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
  })),
  getAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "schools") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: schoolSingle }),
          }),
          update: () => ({ eq: schoolUpdateEq }),
        };
      }
      return { insert: auditInsert };
    },
  })),
}));
vi.mock("@/lib/email", () => ({
  sendSchoolVerificationDecisionEmail: sendDecisionEmail,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reviewSchoolVerification } from "@/app/actions/settings";

function form(decision: "verified" | "rejected", note = "") {
  const data = new FormData();
  data.set("schoolId", "00000000-0000-4000-8000-000000000002");
  data.set("decision", decision);
  data.set("note", note);
  return data;
}

describe("reviewSchoolVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPER_ADMIN_EMAIL = "owner@minerval.org";
    authGetUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "owner@minerval.org",
        },
      },
    });
    schoolSingle.mockResolvedValue({
      data: {
        id: "00000000-0000-4000-8000-000000000002",
        name: "École Test",
        admin_email: "school@example.com",
      },
      error: null,
    });
    schoolUpdateEq.mockResolvedValue({ error: null });
    auditInsert.mockResolvedValue({ error: null });
    sendDecisionEmail.mockResolvedValue(undefined);
  });

  it("requires a correction reason and returns it to the form", async () => {
    const result = await reviewSchoolVerification(undefined, form("rejected"));
    expect(result?.error).toMatch(/corrections demandées/i);
    expect(schoolUpdateEq).not.toHaveBeenCalled();
  });

  it("approves the school, audits the decision, and notifies the owner", async () => {
    const result = await reviewSchoolVerification(undefined, form("verified"));
    expect(result?.success).toBe(true);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "verified" })
    );
    expect(sendDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "school@example.com",
        decision: "verified",
      })
    );
  });

  it("stores and sends the correction reason", async () => {
    const result = await reviewSchoolVerification(
      undefined,
      form("rejected", "Ajoutez votre RCCM.")
    );
    expect(result?.success).toBe(true);
    expect(sendDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Ajoutez votre RCCM." })
    );
  });
});
