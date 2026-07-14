import { describe, expect, it, vi } from "vitest";
import { buildSchoolExport } from "@/lib/school-export";

describe("buildSchoolExport", () => {
  it("collects school-owned records while excluding access and invite tokens", async () => {
    const selectedColumns = new Map<string, string>();
    const from = vi.fn((table: string) => ({
      select: (columns: string) => {
        selectedColumns.set(table, columns);
        if (table === "schools") {
          return {
            eq: () => ({
              single: async () => ({
                data: { id: "school-1", name: "Ecole Test", code: "test" },
                error: null,
              }),
            }),
          };
        }

        const query = {
          eq: () => query,
          order: () => query,
          range: async () => ({
            data:
              table === "payment_events"
                ? [{ id: "event-1", payment_requests: { school_id: "school-1" } }]
                : [{ id: `${table}-1` }],
            error: null,
          }),
        };
        return query;
      },
    }));

    const result = await buildSchoolExport(
      { from } as never,
      "school-1",
      "2026-07-14T00:00:00.000Z"
    );

    expect(result).toMatchObject({
      schema_version: 1,
      generated_at: "2026-07-14T00:00:00.000Z",
      school: { id: "school-1" },
      payment_events: [{ id: "event-1" }],
    });
    expect(selectedColumns.get("schools")).not.toContain("payment_access_token");
    expect(selectedColumns.get("school_invites")).not.toContain("token");
    expect(from).toHaveBeenCalledWith("school_payouts");
    expect(from).toHaveBeenCalledWith("billing_events");
  });
});
