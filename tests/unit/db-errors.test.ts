import { describe, expect, it } from "vitest";

import { dbErrorKey } from "@/server/modules/shared/db-errors";

describe("database error mapping", () => {
  it("maps Postgres codes to user-facing keys", () => {
    expect(dbErrorKey({ code: "42501" })).toBe("notAllowed");
    expect(dbErrorKey({ code: "23505" })).toBe("duplicate");
    expect(dbErrorKey({ code: "23514", message: "too many rows in service_faqs (maximum 15)" })).toBe("limitReached");
    expect(dbErrorKey({ code: "23514", message: "new row violates check constraint" })).toBe("invalid");
    expect(dbErrorKey({ code: "55000" })).toBe("wrongState");
    expect(dbErrorKey({ code: "XX000" })).toBe("generic");
    expect(dbErrorKey(null)).toBe("generic");
  });
});
