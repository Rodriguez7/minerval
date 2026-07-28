import { describe, expect, it } from "vitest";
import { normalizeDrcMobilePhone, normalizeWhatsAppPhone } from "@/lib/phone";

describe("normalizeDrcMobilePhone", () => {
  it.each([
    ["0812345678", "243812345678"],
    ["81 234 56 78", "243812345678"],
    ["+243 812 345 678", "243812345678"],
    ["00243-812-345-678", "243812345678"],
    ["+243 (0) 812 345 678", "243812345678"],
    ["0991234567", "243991234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDrcMobilePhone(input)).toBe(expected);
  });

  it.each([
    "",
    "0712345678",
    "+244812345678",
    "08123",
    "08123456789",
    "+243+812345678",
    "0812ABC678",
  ])("rejects %s", (input) => {
    expect(normalizeDrcMobilePhone(input)).toBeNull();
  });
});

describe("normalizeWhatsAppPhone", () => {
  it.each([
    ["+43 660 000 0000", "436600000000"],
    ["0043 660 000 0000", "436600000000"],
    ["+243 999 000 001", "243999000001"],
    ["0812345678", "243812345678"],
  ])("normalizes international WhatsApp number %s", (input, expected) => {
    expect(normalizeWhatsAppPhone(input)).toBe(expected);
  });

  it.each(["", "+012345678", "123", "+43+6606628661", "phone"])(
    "rejects invalid international number %s",
    (input) => {
      expect(normalizeWhatsAppPhone(input)).toBeNull();
    }
  );
});
