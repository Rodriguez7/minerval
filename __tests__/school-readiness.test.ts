import { describe, expect, it } from "vitest";
import {
  getSchoolReadinessItems,
  getWhatsAppBlockers,
  hasCompleteVerificationProfile,
} from "@/lib/school-readiness";
import type { School } from "@/lib/types";

const school = {
  id: "school-1",
  name: "École Test",
  code: "ecole-test",
  status: "active",
  verification_status: "unverified",
  legal_name: null,
  school_address: null,
  director_name: null,
  director_phone: null,
  payout_account_name: null,
  payout_account_phone: null,
} as School;

describe("school readiness", () => {
  it("explains every reason WhatsApp is blocked", () => {
    const blockers = getWhatsAppBlockers(
      school,
      { students: 0, guardians: 0, balancesWithDueDate: 0 },
      { automaticRemindersEnabled: false },
      "en"
    );
    expect(blockers).toEqual([
      "The school’s internal verification is not complete.",
      "Automatic reminders are disabled.",
      "No students have been added.",
      "No consenting WhatsApp guardian has been added.",
      "No unpaid balance has a due date.",
    ]);
  });

  it("reports ready when all operational gates are satisfied", () => {
    const readySchool = {
      ...school,
      verification_status: "verified",
      legal_name: "École Test SARL",
      school_address: "1 Avenue Test",
      director_name: "Alex Test",
    } as School;
    expect(hasCompleteVerificationProfile(readySchool)).toBe(true);
    expect(
      getWhatsAppBlockers(
        readySchool,
        { students: 1, guardians: 1, balancesWithDueDate: 1 },
        { automaticRemindersEnabled: true },
        "fr"
      )
    ).toEqual([]);
    expect(
      getSchoolReadinessItems(
        readySchool,
        { students: 1, guardians: 1, balancesWithDueDate: 1 },
        { automaticRemindersEnabled: true },
        "fr"
      ).every((item) => item.complete)
    ).toBe(true);
  });
});
