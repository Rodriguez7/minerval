import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "@/app/api/dashboard/school/verification-documents/route";
import { getTenantContext } from "@/lib/tenant";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));

const upload = vi.fn();
const remove = vi.fn();
const insertSingle = vi.fn();
const lookupSingle = vi.fn();
const deleteEqSchool = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getAdminClient: () => ({
    storage: {
      from: () => ({ upload, remove }),
    },
    from: (table: string) => {
      if (table !== "school_verification_documents") return {};
      return {
        insert: () => ({
          select: () => ({ single: insertSingle }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: lookupSingle }),
          }),
        }),
        delete: () => ({
          eq: () => ({ eq: deleteEqSchool }),
        }),
      };
    },
  }),
}));

function tenant(role: "owner" | "admin" | "finance" | "viewer" = "owner") {
  vi.mocked(getTenantContext).mockResolvedValue({
    user: { id: "00000000-0000-4000-8000-000000000001" },
    school: { id: "00000000-0000-4000-8000-000000000002" },
    membership: { role },
  } as never);
}

function uploadRequest(file?: File, documentType = "registration_certificate") {
  const formData = new FormData();
  formData.set("documentType", documentType);
  if (file) formData.set("document", file);
  return new NextRequest(
    "http://localhost/api/dashboard/school/verification-documents",
    { method: "POST", body: formData }
  );
}

describe("school verification document route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenant();
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    insertSingle.mockResolvedValue({
      data: { id: "doc-1", file_name: "rccm.pdf" },
      error: null,
    });
  });

  it("rejects roles that cannot manage the school", async () => {
    tenant("viewer");
    const response = await POST(
      uploadRequest(new File(["pdf"], "rccm.pdf", { type: "application/pdf" }))
    );
    expect(response.status).toBe(403);
  });

  it("rejects unsafe file types", async () => {
    const response = await POST(
      uploadRequest(new File(["bad"], "script.html", { type: "text/html" }))
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/PDF/);
  });

  it("uploads a private verification document and stores its metadata", async () => {
    const response = await POST(
      uploadRequest(new File(["pdf"], "rccm.pdf", { type: "application/pdf" }))
    );
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(
        /^00000000-0000-4000-8000-000000000002\/.+\.pdf$/
      ),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "application/pdf", upsert: false })
    );
    expect(insertSingle).toHaveBeenCalled();
  });

  it("only deletes a document found inside the current school", async () => {
    lookupSingle.mockResolvedValue({
      data: { id: "doc-1", storage_path: "school/doc-1.pdf" },
      error: null,
    });
    deleteEqSchool.mockResolvedValue({ error: null });
    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/dashboard/school/verification-documents?id=doc-1",
        { method: "DELETE" }
      )
    );
    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(["school/doc-1.pdf"]);
  });
});
