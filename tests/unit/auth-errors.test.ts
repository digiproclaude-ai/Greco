import { describe, expect, it } from "vitest";

import { authErrorKey } from "@/server/modules/identity/auth-errors";

describe("authErrorKey", () => {
  it.each([
    ["invalid_credentials", "invalidCredentials"],
    ["email_not_confirmed", "emailNotConfirmed"],
    ["over_email_send_rate_limit", "rateLimited"],
    ["weak_password", "weakPassword"],
    ["user_already_exists", "emailTaken"],
    ["mfa_verification_failed", "invalidCode"],
    ["otp_expired", "linkInvalid"],
  ] as const)("maps %s to %s", (code, key) => {
    expect(authErrorKey({ code })).toBe(key);
  });

  it("never exposes unknown provider errors", () => {
    expect(authErrorKey({ code: "something_new" })).toBe("generic");
    expect(authErrorKey({ status: 429 })).toBe("rateLimited");
    expect(authErrorKey(null)).toBe("generic");
  });
});
