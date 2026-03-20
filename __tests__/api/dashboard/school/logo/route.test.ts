import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dashboard/school/logo/route";
import { NextRequest } from "next/server";

// Mock getTenantContext
vi.mock("@/lib/tenant", () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    school: { id: "school-123" },
  }),
}));

// Mock getAdminClient — storage and DB ops
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
vi.mock("@/lib/supabase", () => ({
  getAdminClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({ error: null }),
      }),
    }),
  }),
}));

function makeRequest(body: FormData) {
  return new NextRequest("http://localhost/api/dashboard/school/logo", {
    method: "POST",
    body,
  });
}

describe("POST /api/dashboard/school/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file is provided", async () => {
    const formData = new FormData();
    const req = makeRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/no file/i);
  });

  it("returns 400 for disallowed MIME type", async () => {
    const formData = new FormData();
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    formData.append("logo", file);
    const req = makeRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/png|jpeg|webp|gif/i);
  });

  it("returns 400 when file exceeds 2MB", async () => {
    const formData = new FormData();
    const bigBuffer = new Uint8Array(3 * 1024 * 1024); // 3MB
    const file = new File([bigBuffer], "big.png", { type: "image/png" });
    formData.append("logo", file);
    const req = makeRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2mb/i);
  });

  it("returns 500 when storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: new Error("storage error") });
    const formData = new FormData();
    const file = new File(["img"], "logo.png", { type: "image/png" });
    formData.append("logo", file);
    const req = makeRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/upload failed/i);
  });

  it("returns logo_url on success", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/school-logos/school-123/logo.png" },
    });
    const formData = new FormData();
    const file = new File(["img"], "logo.png", { type: "image/png" });
    formData.append("logo", file);
    const req = makeRequest(formData);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.logo_url).toContain("school-logos/school-123/logo.png");
    expect(json.logo_url).toContain("?t=");
  });
});
