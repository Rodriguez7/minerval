import { describe, expect, it } from "vitest";
import {
  generateStudentPaymentToken,
  hashStudentPaymentToken,
} from "@/lib/student-payment-link";

describe("secure student payment tokens", () => {
  it("generates URL-safe high-entropy tokens and stores a one-way hash", () => {
    const token = generateStudentPaymentToken();
    const second = generateStudentPaymentToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,60}$/);
    expect(second).not.toBe(token);
    expect(hashStudentPaymentToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashStudentPaymentToken(token)).not.toContain(token);
  });
});
