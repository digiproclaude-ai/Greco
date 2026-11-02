import { describe, expect, it } from "vitest";

import { applyBps, formatMoney, minorToDecimalString, parseMoneyToMinor, providerEarnings, splitDeposit } from "@/lib/money";

describe("money helpers", () => {
  it("parse amounts into minor units without floats", () => {
    expect(parseMoneyToMinor("49", "USD")).toBe(4900);
    expect(parseMoneyToMinor("49.5", "USD")).toBe(4950);
    expect(parseMoneyToMinor("1,250.99", "EUR")).toBe(125099);
    expect(parseMoneyToMinor("0.1", "USD")).toBe(10);
    expect(parseMoneyToMinor("19.999", "USD")).toBeNull();
    expect(parseMoneyToMinor("-5", "USD")).toBeNull();
    expect(parseMoneyToMinor("abc", "USD")).toBeNull();
    expect(parseMoneyToMinor("1500", "JPY")).toBe(1500);
    expect(parseMoneyToMinor("15.5", "JPY")).toBeNull();
  });

  it("turn minor units back into decimal strings", () => {
    expect(minorToDecimalString(4999, "USD")).toBe("49.99");
    expect(minorToDecimalString(5, "EUR")).toBe("0.05");
    expect(minorToDecimalString(1500, "JPY")).toBe("1500");
  });

  it("format money for the locale", () => {
    expect(formatMoney(250000, "USD", "en")).toBe("$2,500.00");
    expect(formatMoney(250000, "USD", "en", { trimZeroFraction: true })).toBe("$2,500");
    expect(formatMoney(4999, "EUR", "en", { trimZeroFraction: true })).toBe("€49.99");
  });

  it("round basis-point shares half up (PAYMENT_ARCHITECTURE.md §8.2)", () => {
    expect(applyBps(10000, 1500)).toBe(1500);
    expect(applyBps(3333, 1500)).toBe(500); // 499.95 -> 500
    expect(applyBps(3330, 1500)).toBe(500); // 499.5 -> 500
    expect(applyBps(3329, 1500)).toBe(499); // 499.35 -> 499
  });

  it("split deposits so the installments add up exactly", () => {
    for (const total of [2500, 30001, 99999, 123457]) {
      for (const bps of [2000, 3000, 4000, 5000]) {
        const { deposit, balance } = splitDeposit(total, bps);
        expect(deposit + balance).toBe(total);
      }
    }
    expect(splitDeposit(30000, 3000)).toEqual({ deposit: 9000, balance: 21000 });
  });

  it("deduct the 15% commission from the provider", () => {
    expect(providerEarnings(100000, 1500)).toEqual({ commission: 15000, earnings: 85000 });
  });
});
