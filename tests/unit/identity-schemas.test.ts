import { describe, expect, it } from "vitest";

import {
  loginSchema,
  mfaCodeSchema,
  registerSchema,
  resetPasswordSchema,
  toFieldErrors,
} from "@/server/modules/identity/schemas";

const validRegistration = {
  fullName: "  Ana Marin ",
  email: " Ana@Example.COM ",
  password: "correct horse battery",
  country: "RO",
  role: "expert",
  legal: "on",
};

describe("registerSchema", () => {
  it("accepts and normalises a valid registration", () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.fullName).toBe("Ana Marin");
    expect(result.email).toBe("ana@example.com");
  });

  it("returns one translatable error per invalid field", () => {
    const result = registerSchema.safeParse({ email: "nope", password: "short", country: "ro", role: "admin" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(errors.email?.key).toBe("email");
    expect(errors.password).toEqual({ key: "passwordMin", values: { min: 10 } });
    expect(errors.country?.key).toBe("country");
    expect(errors.role?.key).toBe("role");
    expect(errors.legal?.key).toBe("legal");
    expect(errors.fullName?.key).toBe("required");
  });

  it("rejects passwords longer than the Auth limit", () => {
    const result = registerSchema.safeParse({ ...validRegistration, password: "x".repeat(73) });
    expect(result.success).toBe(false);
  });
});

describe("other auth schemas", () => {
  it("requires matching passwords on reset", () => {
    const result = resetPasswordSchema.safeParse({ password: "long enough pass", confirm: "different pass" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error).confirm?.key).toBe("passwordMismatch");
  });

  it("only accepts 6-digit codes", () => {
    expect(mfaCodeSchema.safeParse({ code: " 123456 " }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });

  it("requires a password on login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
