import { describe, expect, it } from "vitest";
import { getReminderStage } from "@/lib/whatsapp-reminders";

describe("automatic WhatsApp reminder stages", () => {
  const dueAt = new Date("2026-09-01T00:00:00.000Z");

  it("does not enroll a balance before its due date", () => {
    expect(
      getReminderStage({
        now: new Date("2026-08-31T12:00:00.000Z"),
        dueAt,
        timezone: "Africa/Kinshasa",
        maxReminders: 6,
      })
    ).toBeNull();
  });

  it.each([
    ["2026-09-01T12:00:00.000Z", 0],
    ["2026-09-04T12:00:00.000Z", 1],
    ["2026-09-08T12:00:00.000Z", 2],
    ["2026-09-15T12:00:00.000Z", 3],
    ["2026-09-29T12:00:00.000Z", 4],
    ["2026-10-13T12:00:00.000Z", 5],
  ])("selects the latest due stage for %s", (now, stage) => {
    expect(
      getReminderStage({
        now: new Date(now),
        dueAt,
        timezone: "Africa/Kinshasa",
        maxReminders: 6,
      })
    ).toBe(stage);
  });

  it("respects the school maximum", () => {
    expect(
      getReminderStage({
        now: new Date("2026-10-13T12:00:00.000Z"),
        dueAt,
        timezone: "Africa/Kinshasa",
        maxReminders: 3,
      })
    ).toBe(2);
  });
});
