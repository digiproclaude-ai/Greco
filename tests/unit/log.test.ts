import { describe, expect, it } from "vitest";

import { redactForLog } from "@/server/log";

describe("log redaction", () => {
  it("redacts sensitive keys at any depth", () => {
    expect(
      redactForLog({ email: "a@b.co", password: "x", nested: { accessToken: "t", apiKey: "k", ok: 1 } }),
    ).toEqual({ email: "a@b.co", password: "[redacted]", nested: { accessToken: "[redacted]", apiKey: "[redacted]", ok: 1 } });
  });

  it("reduces errors to name and message", () => {
    expect(redactForLog({ error: new TypeError("boom") })).toEqual({ error: { name: "TypeError", message: "boom" } });
  });
});
