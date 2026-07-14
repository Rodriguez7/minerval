import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { getAdminClient } from "@/lib/supabase";

function schoolQuery(result: object) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("public school payment access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows only active schools", async () => {
    const query = schoolQuery({
      data: { id: "school-1", payment_access_token: "token", logo_url: null },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn(() => query) } as never);

    await getSchoolByPaymentAccessToken("token");

    expect(query.eq).toHaveBeenCalledWith("payment_access_token", "token");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
  });

  it("keeps the active-school guard on the schema-cache fallback", async () => {
    const primary = schoolQuery({
      data: null,
      error: { message: 'column schools.logo_url does not exist' },
    });
    const fallback = schoolQuery({
      data: { id: "school-1", payment_access_token: "token" },
      error: null,
    });
    const from = vi.fn().mockReturnValueOnce(primary).mockReturnValueOnce(fallback);
    vi.mocked(getAdminClient).mockReturnValue({ from } as never);

    await getSchoolByPaymentAccessToken("token");

    expect(fallback.eq).toHaveBeenCalledWith("status", "active");
  });
});
